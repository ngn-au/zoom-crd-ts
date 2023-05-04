// Import required libraries
import axios from 'axios';
import fs from 'fs';
import SambaClient from 'samba-client';
import sanitize from 'sanitize-filename';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first')

// Define interfaces for Zoom webhook body and headers
export interface IZoomWebhookBody {
    event: string;
    payload: {
      plainToken?: any;
      object: {
        recordings: Array<{
          owner: {
            extension_number: string;
            name: string;
          };
          caller_number: string;
          callee_number: string;
          direction: string;
          duration: number;
          accepted_by?: {
            extension_number: string;
          };
          outgoing_by?: {
            extension_number: string;
          };
        }>;
      };
    };
}

export interface IZoomHeaders {
    "x-zm-trackingid": string,
    "x-zm-request-timestamp": string
    "x-zm-signature": string
}

// Setting time format
const localeOptions = { hour:'numeric', minute: 'numeric', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour12: true }
const logLocaleOptions = { second: 'numeric', hour:'numeric', minute: 'numeric', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour12: true }

// Helper function to format seconds into a readable string
function formatSeconds(seconds: any) {
  var hours = Math.floor(seconds / 3600);
  var minutes = Math.floor((seconds - (hours * 3600)) / 60);
  var seconds: any = seconds - (hours * 3600) - (minutes * 60);

  var timeString = '';
  if (hours > 0) {
    timeString += hours + 'h ';
  }
  if (minutes > 0 || timeString !== '') {
    timeString += minutes + 'm ';
  }
  if (seconds >= 0 || timeString === '') {
    timeString += seconds + 's';
  }
  return timeString;
}

// Helper function to wait for a specified number of milliseconds
async function wait(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

// Main function to fetch call recordings and upload them to the Samba share
async function fetchAndDrop(body: IZoomWebhookBody, headers: IZoomHeaders) {
    let extension_number = body.payload.object.recordings[0].owner.extension_number
    let owner_name = body.payload.object.recordings[0].owner.name
  
    // call id is embedded in zoom's initial request to us, but we strip everything after and including the +
    let callId = headers['x-zm-trackingid'].substring(0, headers['x-zm-trackingid'].indexOf("+"))
    
    // build header, including Authorization token ie. base64encode(CLIENTID:CLIENTSECRET)
    const CREDENTIALS_HEADER = {
      headers: { Accept: 'application/json',
                Authorization: 'Basic '+btoa(process.env.ZOOM_APP_CLIENT_ID+':'+process.env.ZOOM_APP_CLIENT_SECRET) 
      },
    }
    let timeForLog = new Date()
    console.log(timeForLog.toLocaleString('en-AU', <object>logLocaleOptions) + ' - Waiting 20 seconds for zoom recording to be "ready"')

    await wait(20000) // wait for 20 seconds

    // Get access_token from Zoom API
    let access_token = await axios
    .post('https://zoom.us/oauth/token?grant_type=account_credentials&account_id='+process.env.ZOOM_APP_ACCOUNT_ID, '', CREDENTIALS_HEADER)
    .then((response) => {
        return response.data.access_token
    })
    .catch((e) => {
        console.error(e)
    })

    // Create authorized header using the access_token
    const AUTHORIZED_HEADER = { 
      headers: { Accept: 'application/json',
                Authorization: 'Bearer '+access_token
      },
    }

    // Fetch user list from Zoom API
    let user_list = await axios
      .get('https://api.zoom.us/v2/phone/users', AUTHORIZED_HEADER)
      .then((response) => {
        return response.data
      })
      .catch((e) => {
        console.error(e)
    })
  
    // Process user list and create user_dir
    let user_dir: any= <object>[]

    // determine initials based on email string, however boss@ is BOS
    user_list.users.forEach((user: any) => {
      if (user.email.startsWith('xyz+')) {
        user_dir[user.extension_number] = user.email.substr(3).replace('@example.com.au', '').toUpperCase()
  
      } else if (user.email == 'boss@example.com.au' ) {
        user_dir[user.extension_number] = 'BOS'
      }
    })

    // Fetch call recording from Zoom API
    let recording = await axios
      .get('https://zoom.us/v2/phone/call_logs/'+callId+'/recordings', AUTHORIZED_HEADER)
      .then((response) => {
        return response.data
      })
      .catch((e) => {
        console.error(e)
      })
    
    // Process recording details and create file and directory names
    let localDate = new Date(recording.date_time)
    let time_stamp = localDate.toLocaleString('en-AU', <object>localeOptions)
    
    // logic to turn user into initials
    let caller_number = body.payload.object.recordings[0].caller_number
    let callee_number = body.payload.object.recordings[0].callee_number
    let direction = body.payload.object.recordings[0].direction

    let caller_name
    let callee_name
    
    // not an outbound reception call
    if (recording.caller_name == owner_name && body.payload.object.recordings[0].outgoing_by === undefined) {
      caller_name = user_dir[extension_number]
    } else if (body.payload.object.recordings[0].outgoing_by !== undefined) {
      caller_name = user_dir[body.payload.object.recordings[0].outgoing_by.extension_number]
    } else {
      caller_name = recording.caller_name
    }

    if (recording.callee_name == owner_name) {
      callee_name = user_dir[extension_number]
    } else {
      callee_name = recording.callee_name
    }

    let filename: any = undefined
    let directory
    let duration_s = body.payload.object.recordings[0].duration
    let duration_units = Math.round(duration_s / 360)

    timeForLog = new Date()
    console.log(timeForLog.toLocaleString('en-AU', <object>logLocaleOptions) + ' - Call from ' +caller_name+ ' to ' + callee_name+" "+time_stamp.replace(':','_')+' '+formatSeconds(duration_s)+' ('+duration_units+' units)');
    let timeAndDuration = time_stamp.replace(':','_')+' '+formatSeconds(duration_s)+' ('+duration_units+' units)'

    // Determine filename and directory based on various conditions 
    if (body.payload.object.recordings[0].accepted_by !== undefined) {
      const ext = body.payload.object.recordings[0].accepted_by.extension_number
      directory = sanitize(user_dir[ext])
      filename = sanitize(caller_name+" to "+directory+" - "+timeAndDuration+'.mp3')
    } else if (body.payload.object.recordings[0].outgoing_by !== undefined ) {
      const ext = body.payload.object.recordings[0].outgoing_by.extension_number
      directory = sanitize(user_dir[ext])
      filename = sanitize(caller_name+" to "+callee_name+" - "+timeAndDuration+'.mp3')
    } else if (user_dir[extension_number] !== undefined) {
      directory = sanitize(user_dir[extension_number])
      filename = sanitize(caller_name+" to "+callee_name+" - "+timeAndDuration+'.mp3')
    } 

    // OMIT inbound internal calls
    
    /*
    if (/^7\d\d/.test(caller_number) && /^7\d\d/.test(callee_number) && direction === 'inbound') { 
    } else {
    } 
    */

    // If filename is defined, proceed to download and upload recording
    if (filename !== undefined) {
      timeForLog = new Date()
      console.log(timeForLog.toLocaleString('en-AU', <object>logLocaleOptions) + ' - Downloading recording...' + filename)

      // Download recording from Zoom
      await axios.get(recording.file_url, {
          responseType: 'arraybuffer'
      }).then(({ data }) => {
          fs.writeFileSync(`./out/${filename}`, data)
      }).catch(err => {
          console.error(`an error ocurred while downloading ${recording.file_url}`, err)
      })
    
      // Configure Samba client
      let client = new SambaClient({
        address: process.env.SAMBA_ADDRESS ?? '', 
        username: process.env.SAMBA_USERNAME ?? '', 
        password: process.env.SAMBA_PASSWORD ?? '', 
        domain: process.env.SAMBA_DOMAIN ?? '', 
        maxProtocol: 'SMB3', 
        maskCmd: true, 
      })

      // Upload recording to SAMBA share
      timeForLog = new Date()
      console.log(timeForLog.toLocaleString('en-AU', <object>logLocaleOptions) + ' - Uploading recording to SAMBA share ' + filename)
      await client.sendFile('out/'+filename, directory+'/'+filename)
    } else {
      timeForLog = new Date()
      console.log(timeForLog.toLocaleString('en-AU', <object>logLocaleOptions) + ' - No user found... skipping!')
    }

  } // end fetchAndDrop() 

export default { fetchAndDrop, logLocaleOptions, localeOptions } 
