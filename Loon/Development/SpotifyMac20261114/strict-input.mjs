// Diagnostic only. No host codecs, coercion, mutation, logging or I/O.
// Serialized into the wrapper, so keep every helper inside this function.
export function strictDiagnosticInput(input) {
  const limit=131072;
  try {
    function stringBytes(text) {
      if(text.length>limit)throw 0;
      let size=0;
      for(let i=0;i<text.length;i++){
        const c=text.charCodeAt(i);
        if(c>=0xd800&&c<=0xdbff){const d=text.charCodeAt(++i);if(!(d>=0xdc00&&d<=0xdfff))throw 0;size+=4;}
        else if(c>=0xdc00&&c<=0xdfff)throw 0;
        else size+=c<128?1:c<2048?2:3;
        if(size>limit)throw 0;
      }
    }
    function textOf(bytes,start){
      const chunks=[],units=[];
      for(let i=start;i<bytes.length;){
        const a=bytes[i++];let c=a,count=0,min=0;
        if(a>=0xc2&&a<=0xdf){c=a&31;count=1;min=128;}
        else if(a>=0xe0&&a<=0xef){c=a&15;count=2;min=2048;}
        else if(a>=0xf0&&a<=0xf4){c=a&7;count=3;min=65536;}
        else if(a>=128)throw 0;
        if(i+count>bytes.length)throw 0;
        for(let n=0;n<count;n++){const b=bytes[i++];if((b&0xc0)!==0x80)throw 0;c=c*64+(b&63);}
        if(c<min||c>0x10ffff||(c>=0xd800&&c<=0xdfff))throw 0;
        if(c>65535){c-=65536;units.push(0xd800+(c>>10),0xdc00+(c&1023));}else units.push(c);
        if(units.length>=1024){chunks.push(String.fromCharCode.apply(null,units));units.length=0;}
      }
      if(units.length)chunks.push(String.fromCharCode.apply(null,units));
      return chunks.join('');
    }
    if(typeof input==='string'){
      stringBytes(input);
      const text=input.charCodeAt(0)===0xfeff?input.slice(1):input;
      return /^[\t\n\r ]*[\[{]/.test(text)?{text,bytes:null}:null;
    }
    const length=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
    let bytes;
    if(ArrayBuffer.isView(input)){
      // The intrinsic brands the underlying buffer across realms and rejects
      // SharedArrayBuffer; only the view's own byte range is inspected.
      length.call(input.buffer);
      if(input.byteLength>limit)return null;
      bytes=new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
    }else{
      const size=length.call(input);if(size>limit)return null;
      bytes=new Uint8Array(input);
    }
    if(!bytes.length)return null;
    const start=bytes[0]===239&&bytes[1]===187&&bytes[2]===191?3:0;
    let at=start;while(at<bytes.length&&[9,10,13,32].includes(bytes[at]))at++;
    if(bytes[at]===123||bytes[at]===91)return {text:textOf(bytes,start),bytes:null};
    // A BOM is a text declaration, not a protobuf tag.
    return start?null:{text:null,bytes};
  }catch{return null;}
}
