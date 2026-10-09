// SPDX-License-Identifier: AGPL-3.0-or-later
#include <emscripten.h>
#include <vector>
#include "Savestate.h"
#include "NDSCart.h"
#include "NDSCart_SRAMManager.h"
static std::vector<unsigned char> battery;
extern "C" {
EMSCRIPTEN_KEEPALIVE size_t web_save_export(){
 const size_t n=NDSCart_SRAMManager::SecondaryBufferLength;
 if(!n||n>8*1024*1024)return 0;
 battery.resize(n);NDSCart_SRAMManager::RequestFlush();
 NDSCart_SRAMManager::FlushSecondaryBuffer(battery.data(),n);return n;
}
EMSCRIPTEN_KEEPALIVE void* web_save_data(){return battery.data();}
EMSCRIPTEN_KEEPALIVE int web_save_import(const void* data,size_t n){
 if(!data||!n||n>8*1024*1024||n!=NDSCart_SRAMManager::SecondaryBufferLength)return 0;
 return NDSCart::ImportSRAM(static_cast<const unsigned char*>(data),n)==0;
}
}
