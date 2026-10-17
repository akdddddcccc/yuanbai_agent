// Only home entry triggers first-time onboarding. Direct game links and tutorial exit stay usable.
(()=>{
  const url=new URL(location.href);
  if(url.searchParams.get('from')!=='home')return;
  const key='yuanbai-school-onboarding-v2';
  let seen=false;
  try{seen=Boolean(localStorage.getItem(key));}catch{}
  if(!seen)try{seen=Boolean(sessionStorage.getItem(key));}catch{}
  if(!seen){location.replace('../tutorial/');return;}
  url.searchParams.delete('from');
  history.replaceState(history.state,'',url.pathname+url.search+url.hash);
})();
