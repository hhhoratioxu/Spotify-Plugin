// Read only the known metadata.Track and existing player/context JSON shapes.
// Never search arbitrary nested keys or infer flags from lyrics/body text.
export function strictJSONFlags(text,route){
  // The approved identity field stays boolean: false means unconfirmed only.
  const unknown=()=>({publicTargetMatched:false,lyricsFlags:['unknown']});
  try{
    if(typeof text!=='string'||text.length>131072)throw 0;
    let at=0,nodes=0;
    const white=()=>{while(at<text.length&&[9,10,13,32].includes(text.charCodeAt(at)))at++;};
    function string(){
      const start=at++;if(text[start]!=='"')throw 0;
      while(at<text.length){
        const c=text.charCodeAt(at++);if(c<32)throw 0;
        if(c===34){
          const value=JSON.parse(text.slice(start,at));
          for(let i=0;i<value.length;i++){const u=value.charCodeAt(i);if(u>=0xd800&&u<=0xdbff){const v=value.charCodeAt(++i);if(!(v>=0xdc00&&v<=0xdfff))throw 0;}else if(u>=0xdc00&&u<=0xdfff)throw 0;}
          return value;
        }
        if(c===92){const e=text[at++];if(e==='u'){if(!/^[0-9a-fA-F]{4}$/.test(text.slice(at,at+4)))throw 0;at+=4;}else if(!'"\\/bfnrt'.includes(e||'\u0000'))throw 0;}
      }throw 0;
    }
    function value(depth){
      if(depth>24||++nodes>8192)throw 0;white();const start=at,c=text[at];
      if(c==='{'){
        at++;white();const keys=new Set();if(text[at]==='}'){at++;return;}
        for(;;){white();const key=string();if(keys.has(key))throw 0;keys.add(key);white();if(text[at++]!==':')throw 0;value(depth+1);white();const sep=text[at++];if(sep==='}')return;if(sep!==',')throw 0;}
      }
      if(c==='['){at++;white();if(text[at]===']'){at++;return;}for(;;){value(depth+1);white();const sep=text[at++];if(sep===']')return;if(sep!==',')throw 0;}}
      if(c==='"'){string();return;}
      for(const word of ['true','false','null'])if(text.startsWith(word,at)){at+=word.length;return;}
      while(at<text.length&&!/[ \t\r\n,\]}]/.test(text[at]))at++;
      if(!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(text.slice(start,at)))throw 0;
    }
    white();if(text[at]!=='{')throw 0;value(0);white();if(at!==text.length)throw 0;
    const doc=JSON.parse(text),object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
    const own=(v,k)=>object(v)&&Object.prototype.hasOwnProperty.call(v,k);
    const targetURI='spotify:track:76XUZSb13QUuj1HECY4Hvo',targetHex='e9b099ff35ac4a9ab73e0e14d20b67a6';
    const flag=(obj,mapped=false)=>{
      if(!object(obj))return 'unknown';
      if(own(obj,'has_lyrics')&&own(obj,'hasLyrics'))return 'unknown';
      const key=own(obj,'has_lyrics')?'has_lyrics':own(obj,'hasLyrics')?'hasLyrics':null;
      if(!key)return 'omitted';const v=obj[key];
      return v===true||mapped&&v==='true'?true:v===false||mapped&&v==='false'?false:'unknown';
    };
    if(route==='metadata'){
      if(!own(doc,'gid')||typeof doc.gid!=='string')return unknown();
      let hex='';
      if(/^[0-9a-f]{32}$/.test(doc.gid))hex=doc.gid;
      else if(/^[A-Za-z0-9+/]{22}==$/.test(doc.gid)){
        const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let bits=0,n=0;
        for(const c of doc.gid.slice(0,22)){n=n*64+alphabet.indexOf(c);bits+=6;if(bits>=8){bits-=8;hex+=Math.floor(n/2**bits).toString(16).padStart(2,'0');n%=2**bits;}}
        if(n!==0||hex.length!==32)return unknown();
      }else return unknown();
      return {publicTargetMatched:hex===targetHex,lyricsFlags:[flag(doc)]};
    }
    const tracks=[];
    if(route==='connect-state'){
      if(!own(doc,'player_state')||!object(doc.player_state))return unknown();
      const state=doc.player_state;
      if(own(state,'track'))tracks.push(state.track);
      for(const key of ['prev_tracks','next_tracks'])if(own(state,key)){if(!Array.isArray(state[key])||state[key].length>16)return unknown();tracks.push(...state[key]);}
    }else if(route==='context-resolve'){
      if(!own(doc,'uri')||typeof doc.uri!=='string'||!/^spotify:[^\s?#]{1,512}$/.test(doc.uri)||!own(doc,'pages')||!Array.isArray(doc.pages)||doc.pages.length>16)return unknown();
      for(const page of doc.pages){if(!object(page)||!own(page,'tracks')||!Array.isArray(page.tracks)||page.tracks.length>16)return unknown();tracks.push(...page.tracks);if(tracks.length>16)return unknown();}
    }else return unknown();
    if(!tracks.length||tracks.length>16||tracks.some(t=>!object(t)||!own(t,'uri')||typeof t.uri!=='string'||!/^spotify:track:[0-9A-Za-z]{22}$/.test(t.uri)))return unknown();
    return {publicTargetMatched:tracks.some(t=>t.uri===targetURI),lyricsFlags:tracks.map(t=>own(t,'metadata')?flag(t.metadata,true):'omitted')};
  }catch{return unknown();}
}
