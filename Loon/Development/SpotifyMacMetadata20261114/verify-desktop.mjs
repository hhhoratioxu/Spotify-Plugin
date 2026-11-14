// Emits facts and hashes; never copies packaged Spotify module source.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {packagedModules,desktopHarness} from './desktop-modules.mjs';
import {sourceBuffer} from '../../../tools/source-snapshot.mjs';
import {fallbackFixture} from './fallback-fixture.mjs';
const packaged=packagedModules(),here=new URL('.',import.meta.url);
const report={recordedAt:new Date().toISOString(),scope:'Unmodified packaged modules executed with mocked React/query/transport and independent source fixtures; not the native application',installedSnapshotAvailable:Boolean(packaged),wireRepresentationEstablished:false,nativeUIValidated:false,liveSourceRequests:0};
if(packaged){
  report.snapshotSHA256=packaged.sha256;report.modules=Object.fromEntries([...packaged.modules].map(([id,source])=>[id,{characters:source.length,sha256:createHash('sha256').update(source).digest('hex')}]));
  const old=sourceBuffer('795c677b0d115cab5eb8e4f959424d905a98e3ff','Loon/script/SpotifyLyrics.Mac.js').toString();
  const fixed=readFileSync(new URL('runtime/SpotifyLyrics.Mac.Fallback.Candidate.js',here),'utf8');
  const before=await fallbackFixture({code:old}),after=await fallbackFixture({code:fixed});
  const falseGate=desktopHarness(packaged,{metadataBody:{has_lyrics:false}});await falseGate.settle();
  const rejected=desktopHarness(packaged,{metadataBody:{has_lyrics:true},lyricBody:JSON.parse(before.effective)}),bad=await rejected.settle();
  const accepted=desktopHarness(packaged,{metadataBody:{has_lyrics:true},lyricBody:JSON.parse(after.effective)}),good=await accepted.settle();
  report.facts={decodedFalseMakesNoLyricsRequest:falseGate.requests.length===1,metadataHelperSpecifiesNoFormatQuery:falseGate.requests[0].query===undefined,availabilityStaleTimeMs:falseGate.queries.find(q=>q.queryKey[0]==='useLyricsAvailability').staleTime,
    existingFallbackHasNoPreviewLines:!Object.hasOwn(JSON.parse(before.effective).lyrics,'previewLines'),packagedParserRejectsExistingFallback:bad.error&&rejected.errors()[0]?.name==='TypeError',candidatePassesPackagedParser:good.error===false&&good.data.hasLyrics===true,candidateKeepsSourceRequestCount:before.calls.length===after.calls.length,startTimes:Array.from(good.data.lyrics,l=>l.start),previewLines:Array.from(good.data.previewLines)};
}
mkdirSync(new URL('evidence/',here),{recursive:true});writeFileSync(new URL('evidence/desktop-contract.json',here),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
