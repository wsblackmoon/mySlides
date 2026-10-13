/* 私享会 · 口令解锁(用法见 CLAUDE.md「私享会」)
   页面里只有密文(由 tools/vault-build.mjs 生成),口令在浏览器本地经 PBKDF2 派生出密钥、用 AES-GCM 解密。
   解锁一次后把派生出的密钥存在本机 localStorage,其他私享会页面免再输;「锁定」会清掉它。 */
(function(){
  var STORE='ws-vault-key';
  var enc=new TextEncoder(),dec=new TextDecoder();
  var gateEl=document.getElementById('vault-gate');
  var payload=JSON.parse(document.getElementById('vault-data').textContent);
  function b64d(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
  function b64e(buf){var u=new Uint8Array(buf),s='';for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s);}

  function derive(pass){
    return crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']).then(function(base){
      return crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(payload.salt),iterations:payload.iter,hash:'SHA-256'},
        base,{name:'AES-GCM',length:256},true,['decrypt']);
    });
  }
  function open(key){
    return crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(payload.iv)},key,b64d(payload.ct)).then(function(pt){return dec.decode(pt);});
  }
  function stored(){try{var s=JSON.parse(localStorage.getItem(STORE)||'null');return s&&s.salt===payload.salt?s.k:null;}catch(e){return null;}}
  function remember(key){
    return crypto.subtle.exportKey('raw',key).then(function(raw){
      try{localStorage.setItem(STORE,JSON.stringify({salt:payload.salt,k:b64e(raw)}));}catch(e){}
    });
  }
  function forget(){try{localStorage.removeItem(STORE);}catch(e){}}
  window.vaultLock=function(){forget();location.reload();};

  function show(text){
    if(payload.kind==='page'){document.open();document.write(text);document.close();}
    else{gateEl.hidden=true;window.vaultRenderHub(JSON.parse(text));}
  }
  function gate(){
    gateEl.hidden=false;
    var form=gateEl.querySelector('form'),inp=gateEl.querySelector('input'),err=gateEl.querySelector('.vg-err'),btn=gateEl.querySelector('button');
    inp.focus();
    form.addEventListener('submit',function(e){
      e.preventDefault();if(!inp.value)return;
      btn.disabled=true;btn.textContent='解锁中…';err.textContent='';
      var key;
      derive(inp.value).then(function(k){key=k;return open(k);})
        .then(function(text){return remember(key).then(function(){show(text);});})
        .catch(function(){err.textContent='口令不正确';btn.disabled=false;btn.textContent='进入';inp.select();});
    });
  }

  if(!(window.crypto&&crypto.subtle)){
    gateEl.hidden=false;gateEl.querySelector('form').innerHTML='<p class="vg-sub">当前浏览器不支持解锁,请用最新版 Chrome / Safari 打开。</p>';
    return;
  }
  var k=stored();
  if(!k){gate();return;}
  crypto.subtle.importKey('raw',b64d(k),'AES-GCM',true,['decrypt']).then(open).then(show)
    .catch(function(){forget();gate();});
})();
