/* vi:set ts=4 sts=4 sw=4 et:
 *
 * VIM - Vi IMproved		by Bram Moolenaar
 *				GUI/Motif support by Robert Webb
 *	      Implemented by rhysd <https://github.com/rhysd>
 *
 * Do ":help uganda"  in Vim to read copying and usage conditions.
 * Do ":help credits" in Vim to see a list of people who contributed.
 * See README.txt for an overview of the Vim source code.
 */

/*
 * runtime.js: JavaScript runtime for Wasm port of Vim by @rhysd.
 */

// Note: Code must be almost written in ES5 because Emscripten optimizes generated JavaScript
// for Empterpreter with uglifyjs.

const VimWasmRuntime = {
    $VW__postset: 'VW.init()',
    $VW: {
        init: function() {
            // Utilities
            function rgbToColorCode(rgb) {
                var code = '';
                for (var i = 0; i < 3; ++i) {
                    var c = (rgb & 0xff).toString(16);
                    code = c + code;
                    if (c.length === 1) {
                        code += '0';
                    }
                    rgb >>= 8;
                }
                return '#' + code;
            }

            // TODO: class VimCursor using DRAW_CURSOR

            function WindowResize(renderer) {
                this.renderer = renderer;
                this.bounceTimerToken = null;
                this.onResize = this.onResize.bind(this);
                window.addEventListener('resize', this.onResize); // TODO: passive: true
            }

            WindowResize.prototype.onVimInit = function() {
                this.resizeVim = Module.cwrap('gui_wasm_resize_shell', null, [
                    'number', // rows
                    'number', // cols
                ]);
                // XXX: Following is also not working
                // this.resizeVim = function(rows, cols) {
                //     Module.ccall('gui_wasm_resize_shell', null, ['number', 'number'], [rows, cols], { async: true });
                // };
            };

            WindowResize.prototype.onVimExit = function() {
                window.removeEventListener('resize', this.onResize);
            };

            WindowResize.prototype.onResize = function(event) {
                if (this.bounceTimerToken !== null) {
                    window.clearTimeout(this.bounceTimerToken);
                }
                const that = this;
                this.bounceTimerToken = setTimeout(function() {
                    that.bounceTimerToken = null;
                    that.doResize();
                }, 1000);
            };

            WindowResize.prototype.doResize = function() {
                const rect = this.renderer.canvas.getBoundingClientRect();
                const rows = Math.floor(rect.height / this.renderer.lineHeight);
                const cols = Math.floor(rect.width / this.renderer.charWidth);
                if (this.renderer.rows === rows && this.renderer.cols === cols) {
                    debug('Unnecessary to resize:', rows, cols, rect);
                    return;
                }
                debug('Resize Vim:', rows, cols, rect);
                this.resizeVim(rows, cols);
            };

            // TODO: IME support
            // TODO: Handle pre-edit IME state
            // TODO: Follow cursor position
            function VimInput(font) {
                this.imeRunning = false;
                this.font = font;
                this.elem = document.getElementById('vim-input');
                // TODO: Bind compositionstart event
                // TODO: Bind compositionend event
                this.elem.addEventListener('keydown', this.onKeydown.bind(this));
                this.elem.addEventListener('blur', this.onBlur.bind(this));
                this.elem.addEventListener('focus', this.onFocus.bind(this));
                this.focus();
            }

            VimInput.prototype.onKeydown = function(event) {
                event.preventDefault();
                event.stopPropagation();
                debug('onKeydown():', event, event.key, event.charCode, event.keyCode);

                var charCode = event.keyCode;
                var special = null;

                // TODO: Move the conversion logic (key name -> key code) to C
                // Since strings cannot be passed to C function as char * if Emterpreter is enabled.
                // Setting { async: true } to ccall() does not help to solve this issue.
                const key = event.key;
                if (key.length > 1) {
                    if (
                        key === 'Unidentified' ||
                        (event.ctrlKey && key === 'Control') ||
                        (event.shiftKey && key === 'Shift') ||
                        (event.altKey && key === 'Alt') ||
                        (event.metaKey && key === 'Meta')
                    ) {
                        debug('Ignore key input', key);
                        return;
                    }

                    // Handles special keys. Logic was from gui_mac.c
                    // Key names were from https://www.w3.org/TR/DOM-Level-3-Events-key/
                    switch (key) {
                        // Maybe need to handle 'Tab' as <C-i>
                        case 'F1':
                            special = 'k1';
                            break;
                        case 'F2':
                            special = 'k2';
                            break;
                        case 'F3':
                            special = 'k3';
                            break;
                        case 'F4':
                            special = 'k4';
                            break;
                        case 'F5':
                            special = 'k5';
                            break;
                        case 'F6':
                            special = 'k6';
                            break;
                        case 'F7':
                            special = 'k7';
                            break;
                        case 'F8':
                            special = 'k8';
                            break;
                        case 'F9':
                            special = 'k9';
                            break;
                        case 'F10':
                            special = 'F;';
                            break;
                        case 'F11':
                            special = 'F1';
                            break;
                        case 'F12':
                            special = 'F2';
                            break;
                        case 'F13':
                            special = 'F3';
                            break;
                        case 'F14':
                            special = 'F4';
                            break;
                        case 'F15':
                            special = 'F5';
                            break;
                        case 'Backspace':
                            special = 'kb';
                            break;
                        case 'Delete':
                            special = 'kD';
                            break;
                        case 'ArrowLeft':
                            special = 'kl';
                            break;
                        case 'ArrowUp':
                            special = 'ku';
                            break;
                        case 'ArrowRight':
                            special = 'kr';
                            break;
                        case 'ArrowDown':
                            special = 'kd';
                            break;
                        case 'PageUp':
                            special = 'kP';
                            break;
                        case 'PageDown':
                            special = 'kN';
                            break;
                        case 'End':
                            special = '@7';
                            break;
                        case 'Home':
                            special = 'kh';
                            break;
                        case 'Insert':
                            special = 'kI';
                            break;
                        case 'Help':
                            special = '%1';
                            break;
                        case 'Undo':
                            special = '&8';
                            break;
                        case 'Print':
                            special = '%9';
                            break;
                    }
                } else {
                    // When `key` is one character, get character code from `key`.
                    // KeyboardEvent.charCode is not available on 'keydown'
                    charCode = event.key.charCodeAt(0);
                }

                if (special === null) {
                    this.sendKeyToVim(charCode, 0, +event.ctrlKey, +event.shiftKey, +event.altKey, +event.metaKey);
                } else {
                    this.sendKeyToVim(
                        special.charCodeAt(0),
                        special.charCodeAt(1),
                        +event.ctrlKey,
                        +event.shiftKey,
                        +event.altKey,
                        +event.metaKey
                    );
                }
            };

            VimInput.prototype.onFocus = function() {
                debug('onFocus()');
                // TODO: Send <FocusGained> special character
            };

            VimInput.prototype.onBlur = function(event) {
                debug('onBlur():', event);
                event.preventDefault();
                // TODO: Send <FocusLost> special character
            };

            VimInput.prototype.setFont = function(name, size) {
                this.elem.style.fontFamily = name;
                this.elem.style.fontSize = size + 'px';
            };

            VimInput.prototype.focus = function() {
                this.elem.focus();
            };

            VimInput.prototype.onVimInit = function() {
                if (VimInput.prototype.sendKeyToVim === undefined) {
                    // Setup C function here since when VW.init() is called, Module.cwrap is not set yet.
                    //
                    // XXX: Coverting 'boolean' to 'number' does not work if Emterpreter is enabled.
                    // So converting to 'number' from 'boolean' is done in JavaScript.
                    VimInput.prototype.sendKeyToVim = Module.cwrap('gui_wasm_send_key', null, [
                        'number', // key code1
                        'number', // key code2 (used for special otherwise 0)
                        'number', // TRUE iff Ctrl key is pressed
                        'number', // TRUE iff Shift key is pressed
                        'number', // TRUE iff Alt key is pressed
                        'number', // TRUE iff Meta key is pressed
                    ]);
                    // XXX: Even if {async: true} is set for ccall(), passing strings as char * to C function
                    // does not work with Emterpreter
                }
            };

            // Origin is at left-above.
            //
            //      O-------------> x
            //      |
            //      |
            //      |
            //      |
            //      V
            //      y

            function CanvasRendererNew() {
                this.canvas = document.getElementById('vim-screen');
                this.ctx = this.canvas.getContext('2d', { alpha: false });
                this.adjustScreenSize();
                this.canvas.addEventListener('click', this.onClick.bind(this));
                this.input = new VimInput();
                // TODO: Add resize event listener
            }

            CanvasRendererNew.prototype.onVimInit = function() {
                this.input.onVimInit();
            };

            CanvasRendererNew.prototype.onVimExit = function() {};

            CanvasRendererNew.prototype.onClick = function(event) {
                this.input.focus();
            };

            CanvasRendererNew.prototype.adjustScreenSize = function() {
                const rect = this.canvas.getBoundingClientRect();
                this.elemHeight = rect.height;
                this.elemWidth = rect.width;
                // May need to notify the DOM element width/height to C
                const dpr = window.devicePixelRatio || 1;
                this.canvas.width = rect.width * dpr;
                this.canvas.height = rect.height * dpr;
            };

            CanvasRendererNew.prototype.setColorFG = function(name) {
                this.fgColor = name;
            };

            CanvasRendererNew.prototype.setColorBG = function(name) {
                this.bgColor = name;
            };

            CanvasRendererNew.prototype.setColorSP = function(name) {
                this.spColor = name;
            };

            CanvasRendererNew.prototype.setFont = function(name, size) {
                this.fontName = name;
                this.input.setFont(name, size);
            };

            CanvasRendererNew.prototype.drawRect = function(x, y, w, h, color, filled) {
                const dpr = window.devicePixelRatio || 1;
                x = Math.floor(x * dpr);
                y = Math.floor(y * dpr);
                w = Math.floor(w * dpr);
                h = Math.floor(h * dpr);
                this.ctx.fillStyle = color;
                if (filled) {
                    this.ctx.fillRect(x, y, w, h);
                } else {
                    this.ctx.rect(x, y, w, h);
                }
            };

            CanvasRendererNew.prototype.drawText = function(
                text,
                ch,
                lh,
                cw,
                x,
                y,
                bold,
                underline,
                undercurl,
                strike
            ) {
                const dpr = window.devicePixelRatio || 1;
                ch = ch * dpr;
                lh = lh * dpr;
                cw = cw * dpr;
                x = x * dpr;
                y = y * dpr;

                var font = Math.floor(ch) + 'px ' + this.fontName;
                if (bold) {
                    font = 'bold ' + font;
                }

                this.ctx.font = font;
                this.ctx.textBaseline = 'top'; // FIXME: Should set 'bottom' from descent of the font
                this.ctx.fillStyle = this.fgColor;

                const yi = Math.floor(y);
                for (var i = 0; i < text.length; ++i) {
                    this.ctx.fillText(text[i], Math.floor(x + cw * i), yi);
                }

                if (underline) {
                    this.ctx.strokeStyle = this.fgColor;
                    this.ctx.lineWidth = 1 * dpr;
                    this.ctx.setLineDash([]);
                    this.ctx.beginPath();
                    // Note: 3 is set with considering the width of line.
                    // TODO: Calcurate the position of the underline with descent.
                    const underlineY = Math.floor(y + lh - 3 * res);
                    this.ctx.moveTo(Math.floor(x), underlineY);
                    this.ctx.lineTo(Math.floor(x + cw * text.length), underlineY);
                    this.ctx.stroke();
                } else if (undercurl) {
                    this.ctx.strokeStyle = this.spColor;
                    this.ctx.lineWidth = 1 * dpr;
                    const curlWidth = Math.floor(cw / 3);
                    this.ctx.setLineDash([curlWidth, curlWidth]);
                    this.ctx.beginPath();
                    // Note: 3 is set with considering the width of line.
                    // TODO: Calcurate the position of the underline with descent.
                    const undercurlY = Math.floor(y + lh - 3 * dpr);
                    this.ctx.moveTo(Math.floor(x), undercurlY);
                    this.ctx.lineTo(Math.floor(x + cw * text.length), undercurlY);
                    this.ctx.stroke();
                } else if (strike) {
                    this.ctx.strokeStyle = this.fgColor;
                    this.ctx.lineWidth = 1 * dpr;
                    this.ctx.beginPath();
                    const strikeY = Math.floor(y + lh / 2);
                    this.ctx.moveTo(Math.floor(x), strikeY);
                    this.ctx.lineTo(Math.floor(x + cw * text.length), strikeY);
                    this.ctx.stroke();
                }
            };

            CanvasRendererNew.prototype.invertRect = function(x, y, w, h) {
                const dpr = window.devicePixelRatio || 1;
                x = Math.floor(x * dpr);
                y = Math.floor(y * dpr);
                w = Math.floor(w * dpr);
                h = Math.floor(h * dpr);

                const img = this.ctx.getImageData(x, y, w, h);
                const data = img.data;
                const len = data.length;
                for (var i = 0; i < len; ++i) {
                    data[i] = 255 - data[i];
                    ++i;
                    data[i] = 255 - data[i];
                    ++i;
                    data[i] = 255 - data[i];
                    ++i; // Skip alpha
                }
                this.ctx.putImageData(img, x, y);
            };

            CanvasRendererNew.prototype.imageScroll = function(x, sy, dy, w, h) {
                const dpr = window.devicePixelRatio || 1;
                x = Math.floor(x * dpr);
                sy = Math.floor(sy * dpr);
                dy = Math.floor(dy * dpr);
                w = Math.floor(w * dpr);
                h = Math.floor(h * dpr);
                this.ctx.drawImage(this.canvas, x, sy, w, h, x, dy, w, h);
            };

            // Editor screen renderer
            function CanvasRenderer() {
                // TODO: These font metrics were from gui_mac.c
                // Font metrics should be measured instead of fixed values since monospace font is
                // different on each platform.
                this.charWidth = 7;
                this.charHeight = 11;
                this.charAscent = 6;
                // line-height is fixed to 1.2 for <canvas>
                this.lineHeight = Math.ceil(this.charHeight * 1.2);
                this.canvas = document.getElementById('vim-screen');
                this.adjustScreenSize();
                this.ctx = this.canvas.getContext('2d', { alpha: false });
                this.canvas.addEventListener('click', this.focus.bind(this));
                this.fontName = 'Monaco,Consolas,monospace';
                this.input = new VimInput();
                this.input.setFont(this.fontName, this.charHeight);
                this.resizer = new WindowResize(this);
            }

            CanvasRenderer.prototype.onVimInit = function() {
                // Setup C function here since when VW.init() is called, Module.cwrap is not set yet.
                //
                // XXX: Coverting 'boolean' to 'number' does not work if Emterpreter is enabled.
                // So converting to 'number' from 'boolean' is done in JavaScript.
                VimInput.prototype.sendKeyToVim = Module.cwrap('gui_wasm_send_key', null, [
                    'number', // key code1
                    'number', // key code2 (used for special otherwise 0)
                    'number', // TRUE iff Ctrl key is pressed
                    'number', // TRUE iff Shift key is pressed
                    'number', // TRUE iff Alt key is pressed
                    'number', // TRUE iff Meta key is pressed
                ]);
                // XXX: Even if {async: true} is set for ccall(), passing strings as char * to C function
                // does not work with Emterpreter
                //
                // VW.VimInput.prototype.sendKeyToVim = function(keyCode, ctrl, shift, meta) {
                //     debug('Send key:', keyCode);
                //     Module.ccall(
                //         'gui_wasm_send_key',
                //         null,
                //         ['number', 'boolean', 'boolean', 'boolean'],
                //         [keyCode, ctrl, shift, meta],
                //         // { async: true },
                //     );
                // };

                this.resizer.onVimInit();
            };

            CanvasRenderer.prototype.onVimExit = function() {
                this.resizer.onVimExit();
            };

            CanvasRenderer.prototype.screenWidth = function() {
                return this.cols * this.getCharWidth();
            };

            CanvasRenderer.prototype.screenHeight = function() {
                return this.rows * this.getLineHeight();
            };

            CanvasRenderer.prototype.getCharWidth = function() {
                return this.charWidth * (window.devicePixelRatio || 1);
            };

            CanvasRenderer.prototype.getCharHeight = function() {
                return this.charHeight * (window.devicePixelRatio || 1);
            };

            CanvasRenderer.prototype.getCharAscent = function() {
                return this.charAscent * (window.devicePixelRatio || 1);
            };

            CanvasRenderer.prototype.getLineHeight = function() {
                return this.lineHeight * (window.devicePixelRatio || 1);
            };

            CanvasRenderer.prototype.mouseX = function() {
                return 0; // TODO
            };

            CanvasRenderer.prototype.mouseY = function() {
                return 0; // TODO
            };

            CanvasRenderer.prototype.setFont = function(fontName) {
                this.fontName = fontName;
                this.input.setFont(this.fontName, this.charHeight);
                // TODO: Font metrics should be measured since monospace font is different on each
                // platform.
            };

            CanvasRenderer.prototype.focus = function() {
                this.input.focus();
            };

            CanvasRenderer.prototype.adjustScreenSize = function() {
                const rect = this.canvas.getBoundingClientRect();
                const rows = Math.floor(rect.height / this.lineHeight);
                const cols = Math.floor(rect.width / this.charWidth);
                if (this.rows === rows && this.cols === cols) {
                    return;
                }
                this.rows = rows;
                this.cols = cols;
                // Do not use this.screenWidth() and this.screenHeight() because they use values converted via Math.floor().
                this.canvas.width = rect.width * (window.devicePixelRatio || 1);
                this.canvas.height = rect.height * (window.devicePixelRatio || 1);
            };

            CanvasRenderer.prototype.resizeScreen = function(rows, cols) {
                if (this.rows === rows && this.cols === cols) {
                    return;
                }
                this.rows = rows;
                this.cols = cols;
                this.canvas.width = this.screenWidth();
                this.canvas.height = this.screenHeight();
            };

            CanvasRenderer.prototype.invertBlock = function(row, col, rows, cols) {
                const cw = this.getCharWidth();
                const ch = this.getLineHeight();
                const x = Math.floor(cw * col);
                const y = Math.floor(ch * row);
                const w = Math.floor(cw * (col2 - col));
                const h = Math.floor(ch * (row2 - row));
                const img = this.ctx.getImageData(x, y, w, h);
                const data = img.data;
                const len = data.length;
                for (var i = 0; i < len; ++i) {
                    data[i] = 255 - data[i];
                    ++i;
                    data[i] = 255 - data[i];
                    ++i;
                    data[i] = 255 - data[i];
                    ++i; // Skip alpha
                }
                this.ctx.putImageData(img, x, y);
            };

            CanvasRenderer.prototype.drawPartCursor = function(row, col, wpix, hpix) {
                // hpix and wpix don't consider device pixel ratio
                const cw = this.getCharWidth();
                const ch = this.getLineHeight();
                const x = Math.floor(cw * col);
                const y = Math.floor(ch * row);
                const res = window.devicePixelRatio || 1;
                const w = Math.floor(wpix * res);
                const h = Math.floor(hpix * res);
                this.ctx.fillStyle = this.fgColor;
                this.ctx.fillRect(x, y, w, h);
            };

            CanvasRenderer.prototype.rect = function(row, col, row2, col2, color, fill) {
                const cw = this.getCharWidth();
                const ch = this.getLineHeight();
                const x = Math.floor(cw * col);
                const y = Math.floor(ch * row);
                const w = Math.floor(cw * (col2 - col + 1));
                const h = Math.floor(ch * (row2 - row + 1));
                this.ctx.fillStyle = color;
                if (fill) {
                    this.ctx.fillRect(x, y, w, h);
                } else {
                    this.ctx.rect(x, y, w, h);
                }
            };

            CanvasRenderer.prototype.clearBlock = function(row, col, row2, col2) {
                this.rect(row, col, row2, col2, this.bgColor, true);
            };

            CanvasRenderer.prototype.clear = function() {
                this.ctx.fillStyle = this.bgColor;
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            };

            // TODO: Draw character for each cells rather than drawing a string at once.
            // This prevents <canvas> render from doing something like font karning.
            CanvasRenderer.prototype.drawText = function(
                row,
                col,
                str,
                bgTransparent,
                bold,
                underline,
                undercurl,
                strike
            ) {
                if (!bgTransparent) {
                    this.clearBlock(row, col, row, col + str.length - 1);
                }

                // TODO: Do not render anything when the string is ' '.
                // Vim renders ' ' with bgTransparent==false for clearing a cursor,
                // but rendering one space in foreground actually does nothing.

                var font = this.getCharHeight() + 'px ' + this.fontName;
                if (bold) {
                    font = 'bold ' + font;
                }
                this.ctx.font = font;
                this.ctx.textBaseline = 'top'; // FIXME: Should set 'bottom' from descent of the font
                this.ctx.fillStyle = this.fgColor;

                const ch = this.getLineHeight();
                const cw = this.getCharWidth();
                const y = Math.floor(row * ch);
                for (var i = 0; i < str.length; ++i) {
                    const x = Math.floor((col + i) * cw);
                    this.ctx.fillText(str[i], x, y);
                }

                const res = window.devicePixelRatio || 1;
                if (underline) {
                    this.ctx.strokeStyle = this.fgColor;
                    this.ctx.lineWidth = 1 * res;
                    this.ctx.setLineDash([]);
                    this.ctx.beginPath();
                    // Note: 3 is set with considering the width of line.
                    // TODO: Calcurate the position of the underline with descent.
                    const underlineY = y + ch - 3 * res;
                    this.ctx.moveTo(x, underlineY);
                    this.ctx.lineTo(x + cw * str.length, underlineY);
                    this.ctx.stroke();
                } else if (undercurl) {
                    this.ctx.strokeStyle = this.spColor;
                    this.ctx.lineWidth = 1 * res;
                    this.ctx.setLineDash([cw / 3, cw / 3]);
                    this.ctx.beginPath();
                    // Note: 3 is set with considering the width of line.
                    // TODO: Calcurate the position of the underline with descent.
                    const undercurlY = y + ch - 3 * res;
                    this.ctx.moveTo(x, undercurlY);
                    this.ctx.lineTo(x + cw * str.length, undercurlY);
                    this.ctx.stroke();
                } else if (strike) {
                    this.ctx.strokeStyle = this.fgColor;
                    this.ctx.lineWidth = 1 * res;
                    this.ctx.beginPath();
                    const strikeY = y + Math.floor(ch / 2);
                    this.ctx.moveTo(x, strikeY);
                    this.ctx.lineTo(x + cw * str.length, strikeY);
                    this.ctx.stroke();
                }
            };

            // Delete the given number of lines from the given row, scrolling up any
            // text further down within the scroll region.
            //
            //  example:
            //    row: 2, num_lines: 2, top: 1, bottom: 4
            //    _: cleared
            //
            //   Before:
            //    1 aaaaa
            //    2 bbbbb
            //    3 ccccc
            //    4 ddddd
            //
            //   After:
            //    1 aaaaa
            //    2 ddddd
            //    3 _____
            //    4 _____
            //
            CanvasRenderer.prototype.deleteLines = function(row, numLines, left, bottom, right) {
                const cw = this.getCharWidth();
                const ch = this.getLineHeight();
                const sx = Math.floor(left * cw);
                const sy = Math.floor((row + numLines) * ch);
                const sw = Math.floor((right - left + 1) * cw);
                const sh = Math.floor((bottom - row - numLines + 1) * ch);
                const dy = Math.floor(row * ch);
                this.ctx.drawImage(this.canvas, sx, sy, sw, sh, sx, dy, sw, sh);
                this.clearBlock(bottom - numLines + 1, left, bottom, right);
            };

            // Insert the given number of lines before the given row, scrolling down any
            // following text within the scroll region.
            //
            //  example:
            //    row: 2, num_lines: 2, top: 1, bottom: 4
            //    _: cleared
            //
            //   Before:
            //    1 aaaaa
            //    2 bbbbb
            //    3 ccccc
            //    4 ddddd
            //
            //   After:
            //    1 aaaaa
            //    2 _____
            //    3 _____
            //    4 bbbbb
            //
            CanvasRenderer.prototype.insertLines = function(row, numLines, left, bottom, right) {
                const cw = this.getCharWidth();
                const ch = this.getLineHeight();
                const sx = Math.floor(left * cw);
                const sy = Math.floor(row * ch);
                const sw = Math.floor((right - left + 1) * cw);
                const sh = Math.floor((bottom - (row + numLines) + 1) * ch);
                const dy = Math.floor((row + numLines) * ch);
                this.ctx.drawImage(this.canvas, sx, sy, sw, sh, sx, dy, sw, sh);
                this.clearBlock(row, left, row + numLines - 1, bottom);
            };

            VW.VimInput = VimInput;
            VW.rgbToColorCode = rgbToColorCode;
            VW.renderer2 = new CanvasRendererNew();
        },
    },

    /*
     * C bridge
     */

    // int vimwasm_call_shell(char *);
    vimwasm_call_shell: function(command) {
        const c = Pointer_stringify(command);
        debug('call_shell:', c);
        // Shell command may be passed here. Catch the exception
        // eval(c);
    },

    // void vimwasm_resize_win(int, int);
    vimwasm_resize_win: function(rows, columns) {
        debug('resize_win: Rows:', rows, 'Columns:', columns);
        VW.renderer.resizeScreen(rows, columns);
    },

    // void vimwasm_will_init(void);
    vimwasm_will_init: function() {
        debug('will_init:');
        VW.renderer2.onVimInit();
    },

    // void vimwasm_will_exit(int);
    vimwasm_will_exit: function(exit_status) {
        debug('will_exit:', exit_status);
        VW.renderer2.onVimExit();
    },

    // int vimwasm_get_char_width(void);
    vimwasm_get_char_width: function() {
        debug('get_char_width:');
        return VW.renderer.charWidth;
    },

    // int vimwasm_get_char_height(void);
    vimwasm_get_char_height: function() {
        debug('get_char_height:');
        return VW.renderer.lineHeight;
    },

    // int vimwasm_get_char_height(void);
    vimwasm_get_char_ascent: function() {
        debug('get_char_ascent:');
        return VW.renderer.charAscent;
    },

    // int vimwasm_get_win_width(void);
    vimwasm_get_win_width: function() {
        debug('get_win_width:');
        return VW.renderer.cols * VW.renderer.charWidth;
    },

    // int vimwasm_get_win_height(void);
    vimwasm_get_win_height: function() {
        debug('get_win_height:');
        return VW.renderer.rows * VW.renderer.charHeight;
    },

    // int vimwasm_resize(int, int, int, int, int, int, int);
    vimwasm_resize: function(width, height, rows, cols) {
        debug('resize:', width, height, rows, cols);
    },

    // void vimwasm_set_font(char *);
    vimwasm_set_font: function(font_name) {
        font_name = Pointer_stringify(font_name);
        debug('set_font:', font_name);
        VW.renderer2.setFont(font_name);
    },

    // int vimwasm_is_font(char *);
    vimwasm_is_font: function(font_name) {
        font_name = Pointer_stringify(font_name);
        debug('is_font:', font_name);
        // TODO: Check the font name is available. Currently font name is fixed to monospace
        return 1;
    },

    // void vimwasm_set_fg_color(long);
    vimwasm_set_fg_color: function(rgb) {
        const color = VW.rgbToColorCode(rgb);
        debug('set_fg_color:', color);
        VW.renderer.fgColor = color;
    },

    // void vimwasm_set_bg_color(long);
    vimwasm_set_bg_color: function(rgb) {
        const color = VW.rgbToColorCode(rgb);
        debug('set_bg_color:', color);
        VW.renderer.bgColor = color;
    },

    // void vimwasm_set_sp_color(long);
    vimwasm_set_sp_color: function(rgb) {
        const color = VW.rgbToColorCode(rgb);
        debug('set_sp_color:', color);
        VW.renderer.spColor = color;
    },

    // void vimwasm_draw_string(int, int, char *, int, int, int, int, int, int);
    vimwasm_draw_string: function(row, col, ptr, len, is_transparent, is_bold, is_underline, is_undercurl, is_strike) {
        const str = Pointer_stringify(ptr, len);
        debug(
            'draw_string:',
            row,
            col,
            "'" + str + "'",
            is_transparent,
            is_bold,
            is_underline,
            is_undercurl,
            is_strike
        );
        VW.renderer.drawText(row, col, str, !!is_transparent, !!is_bold, !!is_underline, !!is_undercurl, !!is_strike);
    },

    // int vimwasm_is_supported_key(char *);
    vimwasm_is_supported_key: function(key_name) {
        key_name = Pointer_stringify(key_name);
        debug('is_supported_key:', key_name);
        // TODO: Check the key is supported in the browser
        return 1;
    },

    // void vimwasm_invert_rectangle(int, int, int, int);
    vimwasm_invert_rectangle: function(row, col, height, width) {
        debug('invert_rectangle:', row, col, height, width);
        VW.renderer.invertBlock(row, col, height, width);
    },

    // void vimwasm_draw_hollow_cursor(int, int);
    vimwasm_draw_hollow_cursor: function(row, col) {
        debug('draw_hollow_cursor:', row, col);
        VW.renderer.rect(row, col, row + 1, col + 1, VW.renderer.fgColor, false);
    },

    // void vimwasm_draw_part_cursor(int, int, int, int);
    vimwasm_draw_part_cursor: function(row, col, width, height) {
        debug('draw_part_cursor:', row, col, width, height);
        VW.renderer.drawPartCursor(row, col, width, height);
    },

    // void vimwasm_clear_block(int, int, int, int);
    vimwasm_clear_block: function(row1, col1, row2, col2) {
        debug('clear_block:', row1, col1, row2, col2);
        VW.renderer.clearBlock(row1, col1, row2, col2);
    },

    // void vimwasm_clear_all(void);
    vimwasm_clear_all: function() {
        debug('clear_all:');
        VW.renderer.clear();
    },

    // void vimwasm_delete_lines(int, int, int, int, int);
    vimwasm_delete_lines: function(row, num_lines, region_left, region_bottom, region_right) {
        debug('delete_lines:', row, num_lines, region_left, region_bottom, region_right);
        VW.renderer.deleteLines(row, num_lines, region_left, region_bottom, region_right);
    },

    // void vimwasm_insert_lines(int, int, int, int, int);
    vimwasm_insert_lines: function(row, num_lines, region_left, region_bottom, region_right) {
        debug('insert_lines:', row, num_lines, region_left, region_bottom, region_right);
        VW.renderer.insertLines(row, num_lines, region_left, region_bottom, region_right);
    },

    // int vimwasm_open_dialog(int, char *, char *, char *, int, char *);
    vimwasm_open_dialog: function(type, title, message, buttons, default_button_idx, textfield) {
        title = Pointer_stringify(title);
        message = Pointer_stringify(message);
        buttons = Pointer_stringify(buttons);
        textfield = Pointer_stringify(textfield);
        debug('open_dialog:', type, title, message, buttons, default_button_idx, textfield);
        // TODO: Show dialog and return which button was pressed
    },

    // int vimwasm_get_mouse_x();
    vimwasm_get_mouse_x: function() {
        debug('get_mouse_x:');
        return VW.renderer.mouseX();
    },

    // int vimwasm_get_mouse_y();
    vimwasm_get_mouse_y: function() {
        debug('get_mouse_y:');
        return VW.renderer.mouseY();
    },

    // void vimwasm_set_title(char *);
    vimwasm_set_title: function(title) {
        title = Pointer_stringify(title);
        debug('set_title:', title);
        document.title = title;
    },

    // void vimwasm_set_fg_color2(char *);
    vimwasm_set_fg_color2: function(name) {
        name = Pointer_stringify(name);
        debug('set_fg_color2:', name);
        VW.renderer2.setColorFG(name);
    },

    // void vimwasm_set_bg_color2(char *);
    vimwasm_set_bg_color2: function(name) {
        name = Pointer_stringify(name);
        debug('set_bg_color2:', name);
        VW.renderer2.setColorBG(name);
    },

    // void vimwasm_set_sp_color2(char *);
    vimwasm_set_sp_color2: function(name) {
        name = Pointer_stringify(name);
        debug('set_sp_color2:', name);
        VW.renderer2.setColorSP(name);
    },

    // int vimwasm_get_dom_width()
    vimwasm_get_dom_width: function() {
        debug('get_dom_width:');
        return VW.renderer2.elemWidth;
    },

    // int vimwasm_get_dom_height()
    vimwasm_get_dom_height: function() {
        debug('get_dom_height:');
        return VW.renderer2.elemHeight;
    },

    // void vimwasm_draw_rect(int, int, int, int, char *, int);
    vimwasm_draw_rect: function(x, y, w, h, color, filled) {
        color = Pointer_stringify(color);
        debug('draw_rect', x, y, w, h, color, !!filled);
        VW.renderer2.drawRect(x, y, w, h, color, !!filled);
    },

    // void vimwasm_draw_text(int, int, int, int, int, char *, int, int, int, int, int);
    vimwasm_draw_text: function(charHeight, lineHeight, charWidth, x, y, str, len, bold, underline, undercurl, strike) {
        const text = Pointer_stringify(str, len);
        debug(
            'draw_text:',
            "'" + text + "'",
            charHeight,
            lineHeight,
            charWidth,
            x,
            y,
            !!bold,
            !!underline,
            !!undercurl,
            !!strike
        );
        VW.renderer2.drawText(
            text,
            charHeight,
            lineHeight,
            charWidth,
            x,
            y,
            !!bold,
            !!underline,
            !!undercurl,
            !!strike
        );
    },

    // void vimwasm_set_font(char *, int);
    vimwasm_set_font2: function(font_name, font_size) {
        font_name = Pointer_stringify(font_name);
        debug('set_font2:', font_name, font_size);
        VW.renderer2.setFont(font_name, font_size);
    },

    // void vimwasm_invert_rect2(int, int, int, int);
    vimwasm_invert_rect2: function(x, y, w, h) {
        debug('invert_rect2:', x, y, w, h);
        VW.renderer2.invertRect(x, y, w, h);
    },

    // void vimwasm_image_scroll(int, int, int, int, int);
    vimwasm_image_scroll: function(x, sy, dy, w, h) {
        debug('image_scroll:', x, sy, dy, w, h);
        VW.renderer2.imageScroll(x, sy, dy, w, h);
    },
};

autoAddDeps(VimWasmRuntime, '$VW');
mergeInto(LibraryManager.library, VimWasmRuntime);
