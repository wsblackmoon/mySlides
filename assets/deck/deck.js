/* mySlides 演示引擎 · 与 deck.css 配套使用（用法见 CLAUDE.md「幻灯片演示工具」）
   页面只需提供 <div class="deck"> 下的若干 <section class="slide">，其余外壳（进度条、目录、计时器）由本脚本注入。 */
(function(){
  var deck=document.querySelector('.deck');if(!deck)return;
  var slides=[].slice.call(deck.children).filter(function(s){return s.classList.contains('slide');});
  var n=slides.length,i=0;
  var back=deck.getAttribute('data-back')||'../index.html#works';
  function $(id){return document.getElementById(id);}

  document.body.insertAdjacentHTML('beforeend',
    '<div class="deck-hint">← → / 空格 翻页 · M 目录 · F 全屏 · Home/End 首末页</div>'+
    '<div class="deck-hud"><span class="no" id="deck-cur">1</span><div class="bar"><i id="deck-prog"></i></div><span class="no">'+n+'</span></div>'+
    '<button id="deck-tm-mini" title="展开目录 (M)">00:00</button>'+
    '<button id="deck-nav-toggle" title="收起目录 (M)" aria-label="收起目录">☰</button>'+
    '<aside id="deck-nav" aria-label="幻灯片目录">'+
      '<div class="np-timer"><span class="t" id="deck-tm">00:00</span><button id="deck-tm-pause" title="开始/暂停">▶</button><button id="deck-tm-reset" title="归零">↺</button></div>'+
      '<div class="np-list" id="deck-nav-list"></div>'+
      '<div class="np-foot"><a id="deck-back">← 返回作品集</a></div>'+
    '</aside>');
  $('deck-back').href=back;

  // ---- 翻页 ----
  var cur=$('deck-cur'),prog=$('deck-prog'),list=$('deck-nav-list');
  function hasBody(s){return !!s.querySelector('.body');}
  function render(rev){
    slides.forEach(function(s,j){
      s.classList.toggle('on',j===i);
      s.classList.toggle('reveal',j===i&&(rev||!hasBody(s)));
    });
    // 懒加载的图片：当前页和下一页提前加载，避免翻页时闪白
    [slides[i],slides[i+1]].forEach(function(s){
      if(s)s.querySelectorAll('img[loading="lazy"]').forEach(function(im){im.loading='eager';});
    });
    var s=slides[i];s.scrollTop=0;if(s.firstElementChild)s.firstElementChild.scrollTop=0;
    cur.textContent=i+1;prog.style.width=((i+1)/n*100)+'%';
    highlight();
  }
  function show(k,rev){i=Math.max(0,Math.min(n-1,k));render(rev);}
  function next(){var s=slides[i];if(hasBody(s)&&!s.classList.contains('reveal')){s.classList.add('reveal');return;}show(i+1,false);}
  function prev(){var s=slides[i];if(hasBody(s)&&s.classList.contains('reveal')){s.classList.remove('reveal');return;}show(i-1,true);}
  function toggleNav(){document.body.classList.toggle('nav-open');}
  function overlayNav(){return window.innerWidth<=760&&document.body.classList.contains('nav-open');}

  document.addEventListener('keydown',function(e){
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    var k=e.key;
    if(k==='ArrowRight'||k==='ArrowDown'||k===' '||k==='PageDown'){e.preventDefault();next();}
    else if(k==='ArrowLeft'||k==='ArrowUp'||k==='PageUp'){e.preventDefault();prev();}
    else if(k==='Home'){show(0,false);}
    else if(k==='End'){show(n-1,true);}
    else if(k==='m'||k==='M'){toggleNav();}
    else if((k==='f'||k==='F')&&document.documentElement.requestFullscreen){
      if(document.fullscreenElement){document.exitFullscreen();}else{document.documentElement.requestFullscreen();}
    }
  });
  // 点击：右侧 1/3 下一步，左侧 15% 上一步（链接、按钮、目录除外）
  document.addEventListener('click',function(e){
    if(e.target.closest('a,button,#deck-nav'))return;
    if(overlayNav()){document.body.classList.remove('nav-open');return;}  // 手机上目录浮层打开时，点外面只收起
    if(e.clientX>window.innerWidth*0.66){next();}
    else if(e.clientX<window.innerWidth*0.15){prev();}
  });
  // 滑动：左右或上下均可翻页；若手指落在可滚动的内容里，上下滑留给滚动
  function scrollableY(t){
    for(;t&&t!==deck;t=t.parentElement){if(t.scrollHeight>t.clientHeight+1&&/(auto|scroll)/.test(getComputedStyle(t).overflowY))return true;}
    return false;
  }
  var tx=null,ty=null,lockY=false;
  document.addEventListener('touchstart',function(e){
    if(e.target.closest('#deck-nav')){tx=null;return;}
    tx=e.touches[0].clientX;ty=e.touches[0].clientY;lockY=scrollableY(e.target);
  },{passive:true});
  document.addEventListener('touchend',function(e){
    if(tx===null)return;
    var dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
    if(Math.abs(dy)>Math.abs(dx)){if(!lockY){if(dy<-40){next();}else if(dy>40){prev();}}}
    else{if(dx<-40){next();}else if(dx>40){prev();}}
    tx=null;ty=null;
  });

  // ---- 左侧目录 ----
  // 分组：slide 的 data-group，或 .kick 里的「PART n / 分组 · 小标题」
  // 条目名：data-nav > kick 里的小标题 > 页内 h1/h2 > 「第 n 页」
  var PART=/PART\s*\d+\s*\/\s*([^·]+?)(?:\s*·\s*(.+))?$/;
  function goto(j){return function(e){e.stopPropagation();if(overlayNav())document.body.classList.remove('nav-open');show(j,true);};}
  function addRow(cls,label,idx){
    var d=document.createElement('div');d.className=cls;d.textContent=label;d.title=label;
    if(idx!=null)d.dataset.idx=idx;list.appendChild(d);return d;
  }
  var curGroup=null,curG=null;
  slides.forEach(function(s,idx){
    var k=s.querySelector('.kick'),kick=k?k.textContent.replace(/\s+/g,' ').trim():'';
    var m=kick.match(PART),h=s.querySelector('h1,h2');
    var group=s.getAttribute('data-group')||(m?m[1].trim():'');
    var sub=s.getAttribute('data-nav')||(m&&m[2]?m[2].trim():'');
    var title=h?h.textContent.replace(/\s+/g,' ').trim():('第 '+(idx+1)+' 页');
    if(group){
      if(group!==curGroup){
        curGroup=group;
        var g=addRow('np-g',group);g.addEventListener('click',goto(idx));
        curG={el:g,first:idx};
        if(sub)addRow('np-item',sub,idx).addEventListener('click',goto(idx));
      }else{
        addRow('np-item',sub||title,idx).addEventListener('click',goto(idx));
      }
      curG.el.dataset.range=curG.first+'-'+idx;
    }else{
      curGroup=null;curG=null;
      addRow('np-g',sub||title,idx).addEventListener('click',goto(idx));
    }
  });
  function highlight(){
    list.querySelectorAll('[data-idx]').forEach(function(el){el.classList.toggle('active',+el.dataset.idx===i);});
    list.querySelectorAll('[data-range]').forEach(function(el){var p=el.dataset.range.split('-');el.classList.toggle('active',i>=+p[0]&&i<=+p[1]);});
    var a=list.querySelector('[data-idx].active')||list.querySelector('[data-range].active');
    if(a)a.scrollIntoView({block:'nearest'});
  }
  $('deck-nav-toggle').addEventListener('click',toggleNav);

  // ---- 计时器 ----
  var elapsed=0,running=false,t0=0,disp=$('deck-tm'),mini=$('deck-tm-mini');
  function fmt(ms){var s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;function p(x){return String(x).padStart(2,'0');}return (h>0?p(h)+':':'')+p(m)+':'+p(ss);}
  function tick(){var v=fmt(elapsed+(running?Date.now()-t0:0));disp.textContent=v;mini.textContent=v;}
  setInterval(tick,300);tick();
  $('deck-tm-pause').addEventListener('click',function(){
    if(running){elapsed+=Date.now()-t0;running=false;}else{t0=Date.now();running=true;}
    this.textContent=running?'⏸':'▶';
  });
  $('deck-tm-reset').addEventListener('click',function(){elapsed=0;t0=Date.now();tick();});
  mini.addEventListener('click',function(){document.body.classList.add('nav-open');});

  window.__deck={goto:function(k){show(k,true);},next:next,prev:prev,count:n,get index(){return i;}};
  if(window.innerWidth>760)document.body.classList.add('nav-open');
  show(0,false);
})();
