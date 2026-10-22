(() => {
  'use strict';
  const ids=['qa-search','qa-category','qa-kind','qa-priority'];
  const controls=ids.map(id=>document.getElementById(id));
  const issues=[...document.querySelectorAll('.issue')];
  function render(){
    const [query,category,kind,priority]=controls.map(c=>c.value.trim().toLowerCase());
    let shown=0;
    issues.forEach(issue=>{
      const visible=(!query||issue.textContent.toLowerCase().includes(query))&&(!category||issue.dataset.category.toLowerCase()===category)&&(!kind||issue.dataset.kind.toLowerCase()===kind)&&(!priority||issue.dataset.priority.toLowerCase()===priority);
      issue.hidden=!visible;if(visible)shown++;
    });
    document.getElementById('qa-count').textContent=`${shown} / ${issues.length}개 표시`;
    document.getElementById('qa-empty').hidden=shown>0;
  }
  controls.forEach(c=>c.addEventListener('input',render));
  document.getElementById('qa-reset').addEventListener('click',()=>{controls.forEach(c=>c.value='');render();});
  function revealHash(){
    const issue=issues.find(item=>'#'+item.id===window.location.hash);
    if(!issue)return;
    controls.forEach(c=>c.value='');render();issue.open=true;issue.scrollIntoView({block:'start'});
  }
  window.addEventListener('hashchange',revealHash);
  document.querySelectorAll('a[href^="#MSW-"]').forEach(a=>a.addEventListener('click',()=>{if(a.hash===window.location.hash)revealHash();}));
  render();revealHash();
})();
