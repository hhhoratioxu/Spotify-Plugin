// Compare only the fixed public test IDs in memory. Never return a URL/ID.
// This identifies a request for the public target; it does not validate that
// the response identity agrees, nor bind flags in a batch to a current track.
export function publicTargetRequest(request){
  try{
    if(typeof request?.url!=='string'||request.url.length>4096)return false;
    return /^https:\/\/(?:spclient\.wg|[a-z0-9-]+-spclient)\.spotify\.com(?::443)?\/(?:metadata\/4\/track\/e9b099ff35ac4a9ab73e0e14d20b67a6|color-lyrics\/v2\/track\/76XUZSb13QUuj1HECY4Hvo(?:\/image\/[^?#\s/]+)?\/?)(?:\?[^#\s]*)?$/.test(request.url);
  }catch{return false;}
}
