// SPDX-License-Identifier: AGPL-3.0-or-later
// Shared settings rows. Labels/controls are trusted HTML supplied by the UI;
// escape user-provided text before passing it here.
import {icon} from './shared.js';
export const row=(label,control,ic='settings')=>`<label class="row">${icon(ic)}<span>${label}</span>${control}</label>`;
export const detail=(title,text,control,ic)=>row(`${title}<small>${text}</small>`,control,ic);
export const action=(label,id,ic='chevron',extra='')=>`<button class="row ${extra}" data-action="${id}">${icon(ic)}<span>${label}</span>${ic==='back'||ic==='chevron'?'':icon('chevron')}</button>`;
export const settingsGroup=(title,rows)=>`<div class="label">${title}</div><div class="settings-group">${rows.join('')}</div>`;
export const switchControl=(setting,checked)=>`<input data-setting="${setting}" type="checkbox" ${checked?'checked':''}>`;
