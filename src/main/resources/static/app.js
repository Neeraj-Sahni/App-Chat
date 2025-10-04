let socket=null;
let username=null;
let pc=null;
let localStream=null;
let remoteStream=null;
const servers={ iceServers:[{urls:"stun:stun.l.google.com:19302"}] };

// DOM
const connectBtn=document.getElementById('connectBtn');
const usernameInput=document.getElementById('username');
const msgInput=document.getElementById('msgInput');
const sendBtn=document.getElementById('sendBtn');
const messages=document.getElementById('messages');
const fileBtn=document.getElementById('fileBtn');
const fileInput=document.getElementById('fileInput');

const videoBtn=document.getElementById("videoCallBtn");
const voiceBtn=document.getElementById("voiceCallBtn");
const endBtn=document.getElementById("endCallBtn");
const localVideo=document.getElementById("localVideo");
const remoteVideo=document.getElementById("remoteVideo");

// Connect
connectBtn.onclick = ()=>{
    if(!usernameInput.value.trim()){ alert('Enter name'); return; }
    username=usernameInput.value.trim();
    startWebSocket();
    usernameInput.disabled=true; connectBtn.disabled=true;
    msgInput.disabled=false; sendBtn.disabled=false; fileBtn.disabled=false;
}

// WebSocket
function startWebSocket(){
    const loc=window.location;
    const wsProtocol=loc.protocol==='https:'?'wss':'ws';
    socket=new WebSocket(`${wsProtocol}://${loc.host}/chat`);

    socket.onopen = ()=> appendSystem('Connected to server');
    socket.onclose = ()=> appendSystem('Disconnected');
    socket.onerror = err=>{ console.error(err); appendSystem('WebSocket error'); };

    socket.onmessage = async ev=>{
        const data = JSON.parse(ev.data);

        if(data.deleteId){
            const li=document.querySelector(`li[data-id="${data.deleteId}"]`);
            if(li) li.remove(); return;
        }

        if(data.type==="call-offer"||data.type==="call-answer"||data.type==="ice-candidate"){
            handleSignalingMessage(data); return;
        }
        if(data.user !== username){
        appendMessage(data.user,data.message,false,data.id,data.type,data.url);
    }
    };
}

// Chat
sendBtn.onclick=sendMessage;
msgInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendMessage();}});
function sendMessage(){
    const txt=msgInput.value.trim();
    if(!txt||!socket||socket.readyState!==WebSocket.OPEN)return;
    const payload={id:Date.now(),user:username,type:"text",message:txt};
    socket.send(JSON.stringify(payload));
    appendMessage(username,txt,true,payload.id,"text");
    msgInput.value='';
}

// File
fileBtn.onclick=()=>fileInput.click();
fileInput.onchange=async()=>{
    const file=fileInput.files[0]; if(!file)return;
    const formData=new FormData(); formData.append("file",file);
    const res=await fetch("/upload",{method:"POST",body:formData});
    const url=await res.text();
    const type=file.type.startsWith("image")?"image":"video";
    const msg={id:Date.now(),user:username,type,url};
    socket.send(JSON.stringify(msg));
    appendMessage(username,"",true,msg.id,type,url);
    fileInput.value="";
}

// Append Message
function appendMessage(from,text,isLocal=false,id=null,type="text",url=null){
    const li=document.createElement('li'); li.dataset.id=id;
    const div=document.createElement('div'); div.className='msg '+(isLocal?'me':'user');

    if(type==="text") div.innerHTML=`<strong>${escapeHtml(from)}:</strong> ${escapeHtml(text)}`;
    else if(type==="image") div.innerHTML=`<strong>${escapeHtml(from)}:</strong><br><img src="${url}" style="max-width:200px;border-radius:8px;">`;
    else if(type==="video") div.innerHTML=`<strong>${escapeHtml(from)}:</strong><br><video src="${url}" style="max-width:200px;border-radius:8px;" controls></video>`;

    li.appendChild(div);
    messages.appendChild(li);
    messages.scrollTop=messages.scrollHeight;
}

function appendSystem(text){
    const li=document.createElement('li'); li.className='system';
    li.innerHTML=`<div class="msg system">${escapeHtml(text)}</div>`;
    messages.appendChild(li); messages.scrollTop=messages.scrollHeight;
}

function escapeHtml(unsafe){ return unsafe.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");}

// ---------------- Video/Voice Call ----------------
videoBtn.onclick=()=>startCall(true);
voiceBtn.onclick=()=>startCall(false);
endBtn.onclick=endCall;

async function startCall(isVideo){
    try{
        localStream=await navigator.mediaDevices.getUserMedia({video:isVideo,audio:true});
    }catch(e){alert("Permission denied"); return;}

    pc=new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track=>pc.addTrack(track,localStream));

    remoteStream=new MediaStream();
    remoteVideo.srcObject=remoteStream;
    pc.ontrack=e=>e.streams[0].getTracks().forEach(t=>remoteStream.addTrack(t));

    localVideo.srcObject=localStream;
    localVideo.style.display=isVideo?"block":"none";
    remoteVideo.style.display="block";

    endBtn.disabled=false; videoBtn.disabled=true; voiceBtn.disabled=true;

    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.send(JSON.stringify({type:"call-offer",offer:offer}));
}

// Handle signaling
async function handleSignalingMessage(data){
    if(!pc) {
        pc=new RTCPeerConnection(servers);
        localStream=await navigator.mediaDevices.getUserMedia({video:false,audio:true}).catch(()=>{});
        if(localStream) localStream.getTracks().forEach(track=>pc.addTrack(track,localStream));
        remoteStream=new MediaStream(); remoteVideo.srcObject=remoteStream;
        pc.ontrack=e=>e.streams[0].getTracks().forEach(t=>remoteStream.addTrack(t));
    }

    if(data.type==="call-offer"){
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer=await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.send(JSON.stringify({type:"call-answer",answer:answer}));
    }

    if(data.type==="call-answer") await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

    if(data.type==="ice-candidate") try{ await pc.addIceCandidate(data.candidate); }catch(e){console.error(e);}

    pc.onicecandidate=e=>{ if(e.candidate) socket.send(JSON.stringify({type:"ice-candidate",candidate:e.candidate})); }
}

// End Call
function endCall(){
    if(pc) pc.close();
    if(localStream) localStream.getTracks().forEach(t=>t.stop());
    if(remoteStream) remoteStream.getTracks().forEach(t=>t.stop());

    localVideo.srcObject=null; remoteVideo.srcObject=null;
    pc=null; localStream=null; remoteStream=null;

    endBtn.disabled=true; videoBtn.disabled=false; voiceBtn.disabled=false;
}
