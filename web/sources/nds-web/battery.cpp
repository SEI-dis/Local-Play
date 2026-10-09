// SPDX-License-Identifier: AGPL-3.0-or-later
// DeSmuME uses file-backed cartridge saves, not RETRO_MEMORY_SAVE_RAM.
#include <emscripten.h>
#include <vector>
#include <cstdio>
#include "MMU.h"
static std::vector<unsigned char> battery;
extern "C" {
EMSCRIPTEN_KEEPALIVE size_t web_save_export(){
 if(!MMU_new.backupDevice.export_raw("/export.sav"))return 0;
 FILE *f=fopen("/export.sav","rb");if(!f)return 0;
 fseek(f,0,SEEK_END);long n=ftell(f);rewind(f);
 if(n<=0||n>64*1024*1024){fclose(f);remove("/export.sav");return 0;}
 battery.resize(n);size_t read=fread(battery.data(),1,n,f);fclose(f);remove("/export.sav");return read==size_t(n)?n:0;
}
EMSCRIPTEN_KEEPALIVE void *web_save_data(){return battery.data();}
EMSCRIPTEN_KEEPALIVE int web_save_import(const void *data,size_t n){
 // Common raw DS save sizes. Refuse wrong-size input before changing the save.
 if(n!=512&&(n<8192||n==16384||n>64*1024*1024||(n&(n-1))))return 0;
 FILE *f=fopen("/import.sav","wb");if(!f)return 0;size_t written=fwrite(data,1,n,f);fclose(f);
 bool ok=written==n&&MMU_new.backupDevice.import_raw("/import.sav");remove("/import.sav");return ok;
}
}
