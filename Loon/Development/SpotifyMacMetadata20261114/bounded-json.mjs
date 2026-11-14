// Syntax/duplicate/work guard plus top-level token locations. No reserialization.
export function boundedJSON(input) {
  if(typeof input!=='string'||input.length>262144)throw Error('json-limit');
  let i=0,nodes=0;const members=Object.create(null);
  const white=()=>{while(i<input.length&&/[ \t\r\n]/.test(input[i]))i++;};
  const string=()=>{
    if(input[i]!=='"')throw Error('string');const start=i++;
    while(i<input.length){
      const c=input.charCodeAt(i++);if(c===34)return JSON.parse(input.slice(start,i));if(c<32)throw Error('control');
      if(c===92){const escaped=input[i++];if(escaped==='u'){if(!/^[0-9a-fA-F]{4}$/.test(input.slice(i,i+4)))throw Error('escape');i+=4;}else if(!'"\\/bfnrt'.includes(escaped||'\u0000'))throw Error('escape');}
    }throw Error('unterminated');
  };
  function value(depth){
    if(depth>32||++nodes>32768)throw Error('structure-limit');white();const start=i,c=input[i];
    if(c==='{'){
      i++;white();const keys=new Set();if(input[i]==='}'){i++;return;}
      while(true){white();const key=string();if(keys.has(key))throw Error('duplicate');keys.add(key);white();if(input[i++]!==':')throw Error('colon');white();const at=i;value(depth+1);if(depth===0)members[key]=[at,i];white();const separator=input[i++];if(separator==='}')return;if(separator!==',')throw Error('comma');}
    }
    if(c==='['){i++;white();if(input[i]===']'){i++;return;}while(true){value(depth+1);white();const separator=input[i++];if(separator===']')return;if(separator!==',')throw Error('comma');}}
    if(c==='"'){string();return;}
    for(const token of ['true','false','null'])if(input.startsWith(token,i)){i+=token.length;return;}
    while(i<input.length&&!/[ \t\r\n,\]}]/.test(input[i]))i++;
    if(!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(input.slice(start,i)))throw Error('number');
  }
  white();if(input[i]!=='{')throw Error('root');value(0);white();if(i!==input.length)throw Error('trailing');
  return {doc:JSON.parse(input),members};
}
