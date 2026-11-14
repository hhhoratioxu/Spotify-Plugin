// Read-only counters for the actual macOS Loon processes. No task attachment,
// memory contents, network contents, credentials or process modification.
#include <libproc.h>
#include <sys/resource.h>
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <unistd.h>

static volatile sig_atomic_t stopped=0;
static void stop(int signal){(void)signal;stopped=1;}
static double now(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec+t.tv_nsec/1e9;}
typedef struct {int pid;unsigned count;unsigned long long start,first_peak,max_phys,max_rss,last_peak,interval_peak;} Target;
int main(int argc,char **argv){
  if(argc<4)return 2;
  double seconds=strtod(argv[1],NULL);int ms=atoi(argv[2]);
  if(seconds<0||seconds>900||ms<50||ms>5000||argc>19)return 2;
  Target targets[16]={0};const int count=argc-3;
  for(int i=0;i<count;i++){targets[i].pid=atoi(argv[i+3]);if(targets[i].pid<1)return 2;}
  signal(SIGINT,stop);signal(SIGTERM,stop);
  printf("{\"kind\":\"method\",\"api\":\"proc_pid_rusage/RUSAGE_INFO_V4\",\"intervalMs\":%d,\"sampledWindowPeak\":true,\"lifetimePeak\":\"kernel high-water since process start, not the test window\",\"units\":\"bytes\"}\n",ms);
  double began=now();int errors=0;
  do {
    double elapsed=now()-began;
    for(int i=0;i<count;i++){
      Target *t=&targets[i];struct rusage_info_v4 r={0};
      if(proc_pid_rusage(t->pid,RUSAGE_INFO_V4,(rusage_info_t *)&r)){
        printf("{\"kind\":\"error\",\"seconds\":%.6f,\"pid\":%d,\"errno\":%d}\n",elapsed,t->pid,errno);errors++;continue;
      }
      if(t->count&&t->start!=r.ri_proc_start_abstime){fprintf(stderr,"PID reused during measurement\n");return 3;}
      if(!t->count){t->start=r.ri_proc_start_abstime;t->first_peak=r.ri_lifetime_max_phys_footprint;}
      t->count++;if(r.ri_phys_footprint>t->max_phys)t->max_phys=r.ri_phys_footprint;
      if(r.ri_resident_size>t->max_rss)t->max_rss=r.ri_resident_size;
      t->last_peak=r.ri_lifetime_max_phys_footprint;t->interval_peak=r.ri_interval_max_phys_footprint;
      printf("{\"kind\":\"sample\",\"seconds\":%.6f,\"pid\":%d,\"physicalFootprintBytes\":%llu,\"residentBytes\":%llu,\"lifetimePeakFootprintBytes\":%llu,\"processStartTicks\":%llu}\n",elapsed,t->pid,(unsigned long long)r.ri_phys_footprint,(unsigned long long)r.ri_resident_size,(unsigned long long)r.ri_lifetime_max_phys_footprint,(unsigned long long)r.ri_proc_start_abstime);
    }
    fflush(stdout);if(seconds==0||elapsed>=seconds||stopped)break;
    struct timespec wait={ms/1000,(ms%1000)*1000000};nanosleep(&wait,NULL);
  }while(!stopped);
  for(int i=0;i<count;i++){Target *t=&targets[i];printf("{\"kind\":\"summary\",\"pid\":%d,\"samples\":%u,\"sampledPeakFootprintBytes\":%llu,\"sampledPeakResidentBytes\":%llu,\"beforeLifetimePeakFootprintBytes\":%llu,\"afterLifetimePeakFootprintBytes\":%llu}\n",t->pid,t->count,t->max_phys,t->max_rss,t->first_peak,t->last_peak);}
  return errors?1:0;
}
