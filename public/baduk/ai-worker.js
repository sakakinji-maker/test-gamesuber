importScripts('engine.js?v=2');
onmessage=({data})=>{try{postMessage({id:data.id,index:Baduk.suggest(data.state,data.level)});}catch(error){postMessage({id:data.id,error:error.message});}};
