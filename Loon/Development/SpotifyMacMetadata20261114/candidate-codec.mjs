import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {boundedJSON} from './bounded-json.mjs';
export function candidateCodec(limit){
  const baseline='10049053ce86bd992e3ebb6511ffb28312ba86fb';
  const source=sourceBuffer(baseline,'Surge/Development/VerseLyrics322/core/spotify-lyrics.js').toString();
  const adapter=sourceBuffer(baseline,'Surge/Development/VerseLyrics322/native-adapter.js').toString();
  function fn(text,name){const m=text.match(new RegExp('^function '+name+'\\([^]*?^}', 'm'));if(!m)throw Error('Missing '+name);return m[0];}
  const constants=['LANGUAGES','SOURCES','str','truth'].map(name=>{const m=source.match(new RegExp('^const '+name+' = [^\\n]+;', 'm'));if(!m)throw Error('Missing '+name);return m[0];}).join('\n');
  return 'const LIMIT='+limit+';let TEXT_UNITS;const nativeQX=false;\n'+constants+'\n'+['utf8Size','putUTF8','utf8','text','settings'].map(n=>fn(source,n)).join('\n')+'\n'+fn(adapter,'nativeArguments')+'\n'+boundedJSON.toString()+'\n';
}
