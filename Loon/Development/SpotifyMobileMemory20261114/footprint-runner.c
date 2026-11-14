// Own-process macOS JSC measurement. This is not an iOS VPN extension.
#include <JavaScriptCore/JavaScript.h>
#include <mach/mach.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
static unsigned long long peak_phys=0,peak_resident=0;
static int peak_supported=1;
typedef struct {char *key,*value;} StoreRow;
static StoreRow shared_rows[256];static int shared_count=0;static size_t shared_bytes=0;
static char *value_string(JSContextRef c,JSValueRef v){JSStringRef s=JSValueToStringCopy(c,v,NULL);size_t n=JSStringGetMaximumUTF8CStringSize(s);if(n>1048576)exit(25);char *out=malloc(n);if(!out)exit(25);JSStringGetUTF8CString(s,out,n);JSStringRelease(s);return out;}
static JSValueRef shared_read(JSContextRef c,JSObjectRef f,JSObjectRef o,size_t n,const JSValueRef args[],JSValueRef *e){
  (void)f;(void)o;(void)e;if(n!=1)return JSValueMakeUndefined(c);char *key=value_string(c,args[0]);
  for(int i=0;i<shared_count;i++)if(!strcmp(key,shared_rows[i].key)){free(key);JSStringRef s=JSStringCreateWithUTF8CString(shared_rows[i].value);JSValueRef v=JSValueMakeString(c,s);JSStringRelease(s);return v;}
  free(key);return JSValueMakeUndefined(c);
}
static JSValueRef shared_write(JSContextRef c,JSObjectRef f,JSObjectRef o,size_t n,const JSValueRef args[],JSValueRef *e){
  (void)f;(void)o;(void)e;if(n!=2)return JSValueMakeBoolean(c,0);char *key=value_string(c,args[0]),*value=value_string(c,args[1]);int at=shared_count;
  for(int i=0;i<shared_count;i++)if(!strcmp(key,shared_rows[i].key)){at=i;break;}
  size_t previous=at<shared_count?strlen(shared_rows[at].value):0,next=shared_bytes-previous+strlen(value);
  if(strlen(key)>512||strlen(value)>262144||next>1048576||at>=256){free(key);free(value);return JSValueMakeBoolean(c,0);}
  if(at<shared_count){free(key);free(shared_rows[at].value);}else{shared_rows[at].key=key;shared_count++;}
  shared_rows[at].value=value;shared_bytes=next;return JSValueMakeBoolean(c,1);
}
static void bind_shared(JSContextRef c){
  const char *names[]={"__sharedRead","__sharedWrite"};JSObjectCallAsFunctionCallback callbacks[]={shared_read,shared_write};
  for(int i=0;i<2;i++){JSStringRef s=JSStringCreateWithUTF8CString(names[i]);JSObjectRef fn=JSObjectMakeFunctionWithCallback(c,s,callbacks[i]);JSObjectSetProperty(c,JSContextGetGlobalObject(c),s,fn,kJSPropertyAttributeReadOnly|kJSPropertyAttributeDontDelete,NULL);JSStringRelease(s);}
}
static unsigned long long measure(void){
  task_vm_info_data_t info={0};mach_msg_type_number_t count=TASK_VM_INFO_COUNT;
  if(task_info(mach_task_self(),TASK_VM_INFO,(task_info_t)&info,&count)!=KERN_SUCCESS)exit(20);
  size_t end=offsetof(task_vm_info_data_t,ledger_phys_footprint_peak)+sizeof(info.ledger_phys_footprint_peak);
  if(count*sizeof(natural_t)<end||info.ledger_phys_footprint_peak<=0)peak_supported=0;
  else if((unsigned long long)info.ledger_phys_footprint_peak>peak_phys)peak_phys=info.ledger_phys_footprint_peak;
  if(info.resident_size_peak>peak_resident)peak_resident=info.resident_size_peak;
  return info.phys_footprint;
}
static double now(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec*1000.0+t.tv_nsec/1e6;}
static JSValueRef evaluate(JSContextRef c,const char *code){
  JSStringRef s=JSStringCreateWithUTF8CString(code);JSValueRef error=NULL,value=JSEvaluateScript(c,s,NULL,NULL,1,&error);JSStringRelease(s);
  if(error){JSStringRef message=JSValueToStringCopy(c,error,NULL);char out[2048];JSStringGetUTF8CString(message,out,sizeof(out));fprintf(stderr,"%s\n",out);JSStringRelease(message);exit(21);}return value;
}
static char *read_file(const char *path){FILE *f=fopen(path,"rb");if(!f)exit(22);fseek(f,0,SEEK_END);long size=ftell(f);rewind(f);if(size<0||size>2097152)exit(23);char *out=malloc(size+1);if(!out||fread(out,1,size,f)!=(size_t)size)exit(23);out[size]=0;fclose(f);return out;}
int main(int argc,char **argv){
  if(argc<4||argc>6)return 2;int repeats=atoi(argv[3]),concurrent=argc>=5?atoi(argv[4]):1,shared=argc==6&&!strcmp(argv[5],"shared");
  if(argc==6&&!shared)return 2;
  if(repeats<1||repeats>200||concurrent<1||concurrent>16)return 2;
  char *host=read_file(argv[1]),*script=read_file(argv[2]),*marked=malloc(strlen(script)+40),*result=NULL;
  strcpy(marked,script);strcat(marked,"\n;__hostReturned=true;\n");
  unsigned long long before=measure();double start=now();
  int max_pending_contexts=0,total_calls=0,coalesced=0;
  for(int i=0;i<repeats;i++){
    JSContextGroupRef groups[16];JSGlobalContextRef contexts[16];int pending=0;
    // Keep independent groups alive together and delay synthetic HTTP jobs
    // until every invocation has started. No shared-context global shortcuts.
    for(int j=0;j<concurrent;j++){
      groups[j]=JSContextGroupCreate();contexts[j]=JSGlobalContextCreateInGroup(groups[j],NULL);
      if(shared)bind_shared(contexts[j]);
      evaluate(contexts[j],host);measure();evaluate(contexts[j],marked);measure();
      if(!JSValueToBoolean(contexts[j],evaluate(contexts[j],"__done")))pending++;
    }
    if(pending>max_pending_contexts)max_pending_contexts=pending;
    for(int step=0;step<1000&&pending;step++){
      pending=0;for(int j=0;j<concurrent;j++)if(!JSValueToBoolean(contexts[j],evaluate(contexts[j],"__done"))){evaluate(contexts[j],"__step()");measure();if(!JSValueToBoolean(contexts[j],evaluate(contexts[j],"__done")))pending++;}
    }
    if(pending)return 24;
    for(int j=0;j<concurrent;j++){
      total_calls+=(int)JSValueToNumber(contexts[j],evaluate(contexts[j],"calls"),NULL);
      if(JSValueToBoolean(contexts[j],evaluate(contexts[j],"__verify().coalesced")))coalesced++;
      JSStringRef s=JSValueToStringCopy(contexts[j],evaluate(contexts[j],"JSON.stringify(__verify())"),NULL);size_t size=JSStringGetMaximumUTF8CStringSize(s);
      free(result);result=malloc(size);JSStringGetUTF8CString(s,result,size);JSStringRelease(s);measure();
    }
    for(int j=0;j<concurrent;j++){JSGlobalContextRelease(contexts[j]);JSContextGroupRelease(groups[j]);measure();}
  }
  unsigned long long after=measure();
  printf("{\"peakFootprintSupported\":%s,\"peakFootprintBytes\":%llu,\"peakResidentBytes\":%llu,\"beforeFootprintBytes\":%llu,\"endFootprintBytes\":%llu,\"milliseconds\":%.3f,\"repeats\":%d,\"concurrency\":%d,\"invocations\":%d,\"maxPendingContexts\":%d,\"sharedStorage\":%s,\"totalCalls\":%d,\"coalesced\":%d,\"result\":%s}\n",peak_supported?"true":"false",peak_phys,peak_resident,before,after,now()-start,repeats,concurrent,repeats*concurrent,max_pending_contexts,shared?"true":"false",total_calls,coalesced,result);
  for(int i=0;i<shared_count;i++){free(shared_rows[i].key);free(shared_rows[i].value);}
  free(result);free(host);free(script);free(marked);return 0;
}
