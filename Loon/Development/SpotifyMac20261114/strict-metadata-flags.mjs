// Diagnostic only: inspect the known metadata.Track envelope without decoding
// title/artist/album strings or emitting any identifier or wire structure.
export function singleTrackFlags(input){
  const unknown=()=>({publicTargetMatched:false,lyricsFlags:['unknown']});
  try{
    if(!ArrayBuffer.isView(input)||input.byteLength>131072)return unknown();
    const bytes=new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
    const target='e9b099ff35ac4a9ab73e0e14d20b67a6';
    let at=0,count=0,gids=0,validGid=false,matched=false,flags=0,value='omitted';
    function uint(){let n=0;for(let i=0;i<5;i++){if(at>=bytes.length)throw 0;const b=bytes[at++];n+=(b&127)*2**(i*7);if(!(b&128))return n;}throw 0;}
    while(at<bytes.length){
      if(++count>4096)throw 0;const tag=uint(),field=Math.floor(tag/8),wire=tag%8;if(!field||tag>4294967295)throw 0;
      if(field===18&&wire!==0){flags++;value='unknown';}
      if(field===1&&wire!==2){gids++;validGid=false;}
      if(wire===0){
        const start=at;let n=0,ended=false;
        for(let i=0;i<10;i++){if(at>=bytes.length)throw 0;const b=bytes[at++];if(i===9&&(b&127)>1)throw 0;if(i<8)n+=(b&127)*2**(i*7);if(!(b&128)){ended=true;break;}}
        if(!ended)throw 0;
        if(field===18){flags++;value=at-start<=8&&Number.isSafeInteger(n)&&n===0?false:at-start<=8&&n===1?true:'unknown';}
      }else if(wire===2){
        const length=uint();if(length>bytes.length-at)throw 0;
        if(field===1){gids++;validGid=length===16;let got='';if(validGid)for(let i=at;i<at+16;i++)got+=bytes[i].toString(16).padStart(2,'0');matched=validGid&&got===target;}
        at+=length;
      }else if(wire===1||wire===5){at+=wire===1?8:4;if(at>bytes.length)throw 0;}
      else throw 0;
    }
    if(gids!==1||!validGid)return unknown();
    return {publicTargetMatched:matched,lyricsFlags:[flags>1?'unknown':value]};
  }catch{return unknown();}
}
