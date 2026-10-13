/* 私享会 · 口令解锁(用法见 CLAUDE.md「私享会」)
   每份资料一个独立口令。页面里只有密文(由 tools/vault-build.mjs 生成),口令在浏览器本地经 PBKDF2 派生密钥、AES-GCM 解密。
   - 目录页:输入口令 → 逐条试解目录里的加密条目 → 解开哪份就进哪份;本机解锁过的资料列在下面
   - 资料页:用本机记住的该资料密钥直接解开,否则要求输入口令
   解锁后派生出的密钥按资料存在本机 localStorage;「锁定」清掉全部。 */
(function(){
  var STORE='ws-vault';
  var enc=new TextEncoder(),dec=new TextDecoder();
  var payload=JSON.parse(document.getElementById('vault-data').textContent);
  function b64d(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
  function b64e(buf){var u=new Uint8Array(buf),s='';for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s);}

  function derive(pass){
    return crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']).then(function(base){
      return crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(payload.salt),iterations:payload.iter,hash:'SHA-256'},
        base,{name:'AES-GCM',length:256},true,['decrypt']);
    });
  }
  function importRaw(k){return crypto.subtle.importKey('raw',b64d(k),'AES-GCM',true,['decrypt']);}
  function open(key,box){
    return crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(box.iv)},key,b64d(box.ct)).then(function(pt){return dec.decode(pt);});
  }
  // 本机记住的密钥:{salt, keys:{slug: base64}};盐变了(重新设过口令体系)就整体作废
  function load(){try{var s=JSON.parse(localStorage.getItem(STORE)||'null');if(s&&s.salt===payload.salt)return s.keys||{};}catch(e){}return {};}
  function save(keys){try{localStorage.setItem(STORE,JSON.stringify({salt:payload.salt,keys:keys}));}catch(e){}}
  window.vaultLock=function(){try{localStorage.removeItem(STORE);}catch(e){}location.reload();};

  function bindForm(form,onKey){
    var inp=form.querySelector('input'),err=form.querySelector('.vg-err'),btn=form.querySelector('button');
    form.addEventListener('submit',function(e){
      e.preventDefault();if(!inp.value)return;
      btn.disabled=true;btn.textContent='解锁中…';err.textContent='';
      derive(inp.value).then(onKey).catch(function(){
        err.textContent='口令不正确';btn.disabled=false;btn.textContent='进入';inp.select();
      });
    });
    inp.focus();
  }

  if(!(window.crypto&&crypto.subtle)){
    document.querySelector('form').innerHTML='<p class="vg-sub">当前浏览器不支持解锁,请用最新版 Chrome / Safari 打开。</p>';
    document.getElementById('vault-gate').hidden=false;return;
  }

  // ---- 资料页 ----
  if(payload.kind==='page'){
    var gateEl=document.getElementById('vault-gate');
    var show=function(html){document.open();document.write(html);document.close();};
    var gate=function(){
      gateEl.hidden=false;
      bindForm(gateEl.querySelector('form'),function(key){
        return open(key,payload).then(function(html){
          return crypto.subtle.exportKey('raw',key).then(function(raw){
            var keys=load();keys[payload.slug]=b64e(raw);save(keys);show(html);
          });
        });
      });
    };
    var k=load()[payload.slug];
    if(!k){gate();return;}
    importRaw(k).then(function(key){return open(key,payload);}).then(show)
      .catch(function(){var keys=load();delete keys[payload.slug];save(keys);gate();});
    return;
  }

  // ---- 目录页 ----
  // 用一把密钥试解所有条目,返回解开的条目信息
  function tryEntries(key){
    return Promise.all(payload.entries.map(function(box){
      return open(key,box).then(JSON.parse,function(){return null;});
    })).then(function(r){return r.filter(Boolean);});
  }
  var keys=load(),unlocked=[];
  Promise.all(Object.keys(keys).map(function(slug){
    return importRaw(keys[slug]).then(tryEntries).then(function(found){
      found=found.filter(function(m){return m.slug===slug;});
      if(found.length)unlocked.push(found[0]);else delete keys[slug];
    },function(){delete keys[slug];});
  })).then(function(){
    save(keys);
    window.vaultRenderHub(unlocked);
    bindForm(document.querySelector('#vault-gate form'),function(key){
      return tryEntries(key).then(function(found){
        if(!found.length)throw new Error('no match');
        return crypto.subtle.exportKey('raw',key).then(function(raw){
          var ks=load();found.forEach(function(m){ks[m.slug]=b64e(raw);});save(ks);
          if(found.length===1)location.href=found[0].href;else location.reload();
        });
      });
    });
  });
})();
