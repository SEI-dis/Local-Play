// SPDX-License-Identifier: AGPL-3.0-or-later
// Two independent WASM memories, one clock and one visible/audio output.
export class LocalLinkCore {
  constructor(primary,secondary){
    this.cores=[primary,secondary];this.canvas=primary.canvas;this.video=primary.video;
    this.width=primary.width;this.height=primary.height;this.fps=primary.fps;this.view=0;
    this.beforeFrame=primary.beforeFrame;this.onError=primary.onError;this.paused=true;this.volume=primary.volume;
    this.cores.forEach(c=>{c.pause(true);c.setSpeed(1);});
    this.tick=t=>{
      this.raf=null;if(this.paused||this.closed)return;
      try{
        const step=1000/this.fps;if(this.clock===null||t-this.clock>150)this.clock=t;
        let frames=0;if(t>=this.clock)this.beforeFrame?.();
        while(!this.paused&&t>=this.clock&&frames<3){
          for(const [i,c]of this.cores.entries()){c.m._web_frame(i===this.view?this.keys:0);c.frames++;if(i===this.view)c.audio();else c.m._web_audio_read();}
          this.clock+=step;frames++;
        }
        if(frames)this.cores[this.view].draw(this.video);
      }catch(e){this.pause(true);this.onError?.(e);}
      if(!this.paused&&!this.closed)this.raf=requestAnimationFrame(this.tick);
    };
  }
  select(view){if(![0,1].includes(view))return;this.setKeys(0);this.cores.forEach(c=>c.stopAudio());this.view=view;this.cores[view].draw(this.video);this.unlockAudio().catch(()=>{});}
  setKeys(mask){this.keys=mask;this.cores.forEach(c=>c.setKeys(0));}
  pause(value){this.paused=value;this.setKeys(0);this.clock=null;cancelAnimationFrame(this.raf);this.raf=null;this.cores.forEach(c=>c.pause(true));if(!value&&!this.closed)this.raf=requestAnimationFrame(this.tick);}
  setVolume(v){this.volume=v;this.cores.forEach(c=>c.setVolume(v));}
  setSpeed(){/* Celio always runs at 1x. */}
  setPreservePitch(value){this.cores.forEach(c=>c.setPreservePitch(value));}
  setFilter(mode){this.cores[0].setFilter(mode);}
  async unlockAudio(){await this.cores[this.view].unlockAudio();}
  frameCount(){return this.cores[0].frameCount();}
  screenshot(){return this.canvas.toDataURL('image/png');}
  dispose(){this.pause(true);this.closed=true;this.cores[1].close();}
}
