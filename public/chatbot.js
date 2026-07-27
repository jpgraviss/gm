(function(){
  var s=document.currentScript,id=s&&s.getAttribute('data-chatbot-id'),
  color=s&&s.getAttribute('data-color')||'#015035',
  pos=s&&s.getAttribute('data-position')||'bottom-right',
  base=s&&s.src?s.src.replace('/chatbot.js',''):'';
  if(!id||!base)return;
  var convId=localStorage.getItem('ghcb_'+id)||'',
  vid=localStorage.getItem('ghcb_vid')||(function(){var v='v_'+Math.random().toString(36).slice(2);localStorage.setItem('ghcb_vid',v);return v})(),
  visitorName=localStorage.getItem('ghcb_name_'+id)||'',
  visitorEmail=localStorage.getItem('ghcb_email_'+id)||'',
  leadCard=null,
  welcome='';
  function el(tag){var e=document.createElement(tag);return e}
  var css=el('style');
  css.textContent='.ghcb-bubble{position:fixed;'+(pos==='bottom-left'?'left':'right')+':20px;bottom:20px;width:56px;height:56px;border-radius:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:99999;transition:transform .2s}.ghcb-bubble:hover{transform:scale(1.1)}.ghcb-win{position:fixed;'+(pos==='bottom-left'?'left':'right')+':20px;bottom:88px;width:380px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 100px);border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.12);z-index:99999;display:flex;flex-direction:column;background:#fff;font-family:system-ui,sans-serif}.ghcb-hdr{padding:16px;color:#fff;display:flex;align-items:center;justify-content:space-between}.ghcb-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}.ghcb-msg{max-width:80%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.4;word-wrap:break-word}.ghcb-bot{background:#f3f4f6;color:#111;align-self:flex-start;border-bottom-left-radius:4px}.ghcb-usr{color:#fff;align-self:flex-end;border-bottom-right-radius:4px}.ghcb-inp{display:flex;border-top:1px solid #e5e7eb;padding:12px}.ghcb-inp input{flex:1;border:none;outline:none;font-size:14px;padding:0 8px}.ghcb-inp button{border:none;cursor:pointer;padding:8px 16px;border-radius:8px;color:#fff;font-size:14px;font-weight:600}.ghcb-notice{text-align:center;font-size:10px;color:#9ca3af;padding:4px 12px 8px;line-height:1.4}.ghcb-notice a{color:#9ca3af;text-decoration:underline}.ghcb-lead{align-self:stretch;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px}.ghcb-lead p{margin:0 0 2px;font-size:12px;color:#6b7280;line-height:1.4}.ghcb-lead input{border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;font-family:system-ui,sans-serif;width:100%;box-sizing:border-box}.ghcb-lead-actions{display:flex;gap:8px;margin-top:2px}.ghcb-lead-actions button{flex:1;border:none;border-radius:8px;padding:8px;font-size:13px;font-weight:600;cursor:pointer}.ghcb-lead-cont{color:#fff}.ghcb-lead-skip{background:#f3f4f6;color:#6b7280}';
  document.head.appendChild(css);
  var bubble=el('div');bubble.className='ghcb-bubble';bubble.style.background=color;
  bubble.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var win=el('div');win.className='ghcb-win';win.style.display='none';
  var hdr=el('div');hdr.className='ghcb-hdr';hdr.style.background=color;
  hdr.innerHTML='<span style="font-weight:700;font-size:15px">Chat with us</span>';
  var closeBtn=el('button');closeBtn.style.cssText='background:none;border:none;cursor:pointer;color:#fff;font-size:20px';closeBtn.textContent='×';
  closeBtn.onclick=function(){win.style.display='none'};hdr.appendChild(closeBtn);
  var msgBox=el('div');msgBox.className='ghcb-msgs';
  var notice=el('div');notice.className='ghcb-notice';
  notice.innerHTML='Conversations are recorded. <a href="'+base+'/privacy" target="_blank">Privacy Policy</a>';
  var inp=el('div');inp.className='ghcb-inp';
  var input=el('input');input.placeholder='Type a message...';
  var btn=el('button');btn.textContent='Send';btn.style.background=color;
  inp.appendChild(input);inp.appendChild(btn);
  win.appendChild(hdr);win.appendChild(msgBox);win.appendChild(notice);win.appendChild(inp);
  document.body.appendChild(bubble);document.body.appendChild(win);
  function addMsg(text,isUser){
    var m=el('div');m.className='ghcb-msg '+(isUser?'ghcb-usr':'ghcb-bot');
    if(isUser)m.style.background=color;
    m.textContent=text;msgBox.appendChild(m);msgBox.scrollTop=msgBox.scrollHeight;
  }
  function removeLeadCard(markSkip){
    if(leadCard){if(leadCard.parentNode)leadCard.parentNode.removeChild(leadCard);leadCard=null}
    if(markSkip)localStorage.setItem('ghcb_skip_'+id,'1');
  }
  function showLeadCard(){
    // Skippable pre-chat lead capture (AUDIT #492) — shown once, right after
    // the welcome message, so a visitor can share a name/email before
    // chatting without it blocking them from just typing a message instead.
    if(visitorName||visitorEmail||localStorage.getItem('ghcb_skip_'+id))return;
    leadCard=el('div');leadCard.className='ghcb-lead';
    var p=el('p');p.textContent='Want us to follow up if we miss you live? Share your name and email (optional).';
    var nameInp=el('input');nameInp.placeholder='Your name';
    var emailInp=el('input');emailInp.type='email';emailInp.placeholder='Your email';
    var row=el('div');row.className='ghcb-lead-actions';
    var contBtn=el('button');contBtn.type='button';contBtn.textContent='Continue';contBtn.className='ghcb-lead-cont';contBtn.style.background=color;
    var skipBtn=el('button');skipBtn.type='button';skipBtn.textContent='Skip';skipBtn.className='ghcb-lead-skip';
    contBtn.onclick=function(){
      visitorName=nameInp.value.trim();visitorEmail=emailInp.value.trim();
      if(visitorName)localStorage.setItem('ghcb_name_'+id,visitorName);
      if(visitorEmail)localStorage.setItem('ghcb_email_'+id,visitorEmail);
      removeLeadCard(true);
    };
    skipBtn.onclick=function(){removeLeadCard(true)};
    row.appendChild(contBtn);row.appendChild(skipBtn);
    leadCard.appendChild(p);leadCard.appendChild(nameInp);leadCard.appendChild(emailInp);leadCard.appendChild(row);
    msgBox.appendChild(leadCard);msgBox.scrollTop=msgBox.scrollHeight;
  }
  function send(){
    var t=input.value.trim();if(!t)return;input.value='';
    if(leadCard)removeLeadCard(true);
    addMsg(t,true);
    fetch(base+'/api/chatbots/'+id+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:t,conversationId:convId,visitorId:vid,visitorName:visitorName||undefined,visitorEmail:visitorEmail||undefined})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.conversationId){convId=d.conversationId;localStorage.setItem('ghcb_'+id,convId)}
      addMsg(d.reply||'Sorry, something went wrong.',false);
    }).catch(function(){addMsg('Connection error. Please try again.',false)});
  }
  btn.onclick=send;input.onkeydown=function(e){if(e.key==='Enter')send()};
  bubble.onclick=function(){
    if(win.style.display==='none'){win.style.display='flex';if(!welcome){
      fetch(base+'/api/chatbots/'+id+'/public').then(function(r){return r.json()}).then(function(d){
        welcome=d.welcome_message||'Hi! How can I help you?';addMsg(welcome,false);showLeadCard();
      }).catch(function(){welcome='Hi!';addMsg('Hi! How can I help you?',false);showLeadCard()});welcome='loading';}
    }else{win.style.display='none'}
  };
})();
