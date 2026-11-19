// Reuse the maintained cache implementation, limits, key and TTL. The Mac
// metadata adapter must not implement a second cache writer or fetch a catalog
// identity again after receiving it on the native request path.
export function macMetadataCacheRuntime(source) {
  const constant = name => {
    const match = source.match(new RegExp('^const '+name+' = .+$','m'));
    if (!match) throw Error('Missing Mac cache constant: '+name);
    return match[0];
  };
  const fn = name => {
    const match = source.match(new RegExp('^function '+name+'\\([^]*?^}', 'm'));
    if (!match) throw Error('Missing Mac cache function: '+name);
    return match[0];
  };
  return ['KEY','CACHE_LIMIT','CACHE_COUNT','MAX_LINES','B62','goodObject'].map(constant).join('\n')+'\n'+
    ['hexBase62','catalogISRC','translationPair','indexedCache','serializedCache','loadCache','cacheMetadata'].map(fn).join('\n')+`
function macRememberMetadata(record) {
  const storage={get:key=>$persistentStore.read(key),set:(key,value)=>$persistentStore.write(value,key)};
  const cache=loadCache({env:nativeArguments(),storage},{metadata:true});
  const meta={id:hexBase62(record.gid),title:record.title,album:record.album,artists:record.artists,duration:record.duration};
  if(record.isrc)meta.isrc=record.isrc;
  cacheMetadata({cache},{meta,hasLyrics:false});
  cache.save();
}
`;
}
