(function () {
    function createElementWithId(type, id, parent) {
        var element = document.createElement(type);
        element.id = id;

        if (parent) {
            parent.appendChild(element);
        }

        return element;
    }

    function BigZoom(offlineMode) {
        var that = this;
        this.ctx = null;
        this.canvas = null;
        this.imgs = Object();
        this.zoom = 0;
        this.maxZoom = 4;
        this.centerX = 0;
        this.centerY = 0;
        this.scrollX = 0;
        this.scrollY = 0;
        this.imageSize = 256;
        this.isMouseDown = false;
        this.downX = 0;
        this.downY = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.lastTime = 0;
        this.downTime = 0;
        this.width = 0;
        this.height = 0;
        this.renderTimeout = 0;
        this.allLoaded = false;
        this.didMouseMove = false;
        this.offlineMode = offlineMode;

        this.mapData = Array();

        this.animationInterval = 0;
        this.zoomAnimationInterval = 0;
        this.notFirst = false;

        this.init = function (container) {
            var canvas = createElementWithId('canvas', 'canvas', container);
            var zoomIn = createElementWithId('div', 'zoomIn', container);
            var zoomOut = createElementWithId('div', 'zoomOut', container);
            var zoomInImage = createElementWithId('img', '', zoomIn);
            var zoomOutImage = createElementWithId('img', '', zoomOut);

            zoomInImage.src = 'zoomIn.png';
            zoomOutImage.src = 'zoomOut.png';

            var popover = createElementWithId('div', 'po', container);
            var poLogo = createElementWithId('img', 'poLogo', popover);
            var poTitle = createElementWithId('div', 'poTitle', popover);
            var poBooth = createElementWithId('div', 'poBooth', popover);
            var poClose = createElementWithId('a', 'poClose', popover);
            var poView = createElementWithId('a', 'poView', popover);

            poClose.innerHTML = 'Close';
            poClose.onclick = that.hideDetails;

            poView.innerHTML = 'View Info';
            poView.onclick = function () { that.hideDetails(); alert('clicked'); };

            if (!('ontouchstart' in window)) {
                canvas.onmousedown = that.mouseDown;
                canvas.onmousemove = that.mouseMove;
                canvas.onmouseup = that.mouseUp;
                canvas.onmouseout = that.mouseUp;
                zoomIn.onclick = that.zoomIn;
                zoomOut.onclick = that.zoomOut;
            }
            else {
                canvas.ontouchstart = that.mouseDown;
                canvas.ontouchmove = that.mouseMove;
                canvas.ontouchend = that.mouseUp;
                zoomIn.ontouchstart = that.zoomIn;
                zoomOut.ontouchstart = that.zoomOut;
            }

            that.canvas = canvas;

            that.width = Math.min(document.body.clientWidth, 320);
            that.height = Math.min(document.body.clientHeight, 480);

            that.centerX = that.width / 2;
            that.centerY = that.height / 2;

            canvas.setAttribute("width", that.width);
            canvas.setAttribute("height", that.height);
            container.style.width = canvas.style.width = that.width + 'px';
            container.style.height = canvas.style.height = that.height + 'px';

            that.ctx = canvas.getContext("2d");
        }

        this.zoomIn = function () {

            if (that.zoom < that.maxZoom) {
                // Let's do an animated zoom, by zooming the element about it's center

                clearInterval(that.zoomAnimationInterval);

                var count = 0;
                var ticks = 15;

                that.allLoaded = false;

                var newZoom = that.zoom + 1;
                var newScrollX = that.scrollX << 1;
                var newScrollY = that.scrollY << 1;

                // start new tile download
                that.performRenderCanvas(newZoom, newScrollX, newScrollY, true);

                that.zoomAnimationInterval = setInterval(function () {

                    var width = that.width * count / ticks;
                    var height = that.height * count / ticks;

                    that.canvas.style['margin-left'] = -(width / 2) + 'px';
                    that.canvas.style.width = that.width + (width) + 'px';

                    that.canvas.style['margin-top'] = -(height / 2) + 'px';
                    that.canvas.style.height = that.height + (height) + 'px';

                    count++;

                    if (count == ticks) {
                        clearInterval(that.zoomAnimationInterval);

                        // We are done.
                        that.canvas.style['margin-left'] = 0 + 'px';
                        that.canvas.style.width = that.width + 'px';

                        that.canvas.style['margin-top'] = 0 + 'px';
                        that.canvas.style.height = that.height + 'px';

                        that.zoom = that.zoom + 1;
                        that.scrollX = that.scrollX << 1;
                        that.scrollY = that.scrollY << 1;

                        that.doRenderCanvas();
                    }
                }, 10);
            }
        }

        this.zoomOut = function () {
            if (that.zoom > 0) {
                // Let's do an animated zoom, by zooming the element about it's center

                clearInterval(that.zoomAnimationInterval);

                var count = 0;
                var ticks = 15;

                that.allLoaded = false;

                var newZoom = that.zoom;
                var newScrollX = that.scrollX;
                var newScrollY = that.scrollY;

                that.zoom = that.zoom - 1;
                that.scrollX = that.scrollX >> 1;
                that.scrollY = that.scrollY >> 1;

                // start new tile download
                that.performRenderCanvas(that.zoom, that.scrollX, that.scrollY, true);

                that.zoomAnimationInterval = setInterval(function () {

                    var width = that.width * (ticks - count) / ticks;
                    var height = that.height * (ticks - count) / ticks;

                    that.canvas.style['margin-left'] = -(width / 2) + 'px';
                    that.canvas.style.width = that.width + (width) + 'px';

                    that.canvas.style['margin-top'] = -(height / 2) + 'px';
                    that.canvas.style.height = that.height + (height) + 'px';

                    if (count == 0) {
                        that.doRenderCanvas();
                    }

                    count++;

                    if (count == ticks) {
                        clearInterval(that.zoomAnimationInterval);

                        // We are done.
                        that.canvas.style['margin-left'] = 0 + 'px';
                        that.canvas.style.width = that.width + 'px';

                        that.canvas.style['margin-top'] = 0 + 'px';
                        that.canvas.style.height = that.height + 'px';

                        that.doRenderCanvas();
                    }
                }, 10);
            }
        }

        this.showDetails = function (vendor) {

            var scaleSize = Math.pow(2, that.zoom) * 256;

            var x = vendor.r.x * scaleSize / 1000;
            var y = vendor.r.y * scaleSize / 1000;

            x = x - that.scrollX + (that.width - scaleSize) / 2;
            y = y - that.scrollY + (that.height - scaleSize) / 2;

            w = vendor.r.w * scaleSize / 1000;

            var divH = 130;
            var divW = 240;

            if (y > that.height / 2) {
                y = y - divH - 10;
            }
            else {
                y = y + (vendor.r.h * scaleSize / 1000) + 10;
            }

            x = Math.max(0, Math.min(that.width - divW, x + (w - divW) / 2));

            document.getElementById('po').style.left = x + 'px';
            document.getElementById('po').style.top = y + 'px';

            document.getElementById('poLogo').src = vendor.image ? vendor.image : 'http://doubledutch.me/img/doubledutch-logo.png';
            document.getElementById('poTitle').innerHTML = vendor.n ? vendor.n : 'Not Occupied';
            document.getElementById('poBooth').innerHTML = 'Booth ' + vendor.id;
            document.getElementById('po').style.display = 'block';

        }

        this.hideDetails = function () {
            document.getElementById('po').style.display = 'none';
        }

        this.mouseDown = function (e) {
            that.isMouseDown = true;
            that.didMouseMove = false;

            that.hideDetails();

            that.downX = that.lastX = e.pageX;
            that.downY = that.lastY = e.pageY;
            that.downTime = that.lastTime = e.timeStamp;

            clearInterval(that.animationInterval);

            return false;
        }

        this.rectContains = function (id, rect, x, y) {

            if (rect.x <= x && rect.y <= y) {
                if (rect.x + rect.w >= x && rect.y + rect.h >= y) {
                    return true;
                }
            }

            return false;
        }

        this.findHitTarget = function (zoom, x, y) {

            // let us scale the x,y to 1 -> 1000
            var scaleSize = Math.pow(2, zoom) * 256;

            x = x + that.scrollX - (that.width - scaleSize) / 2;
            y = y + that.scrollY - (that.height - scaleSize) / 2;

            x = x * 1000 / scaleSize;
            y = y * 1000 / scaleSize;

            for (var i = 0; i < that.mapData.length; ++i) {
                var vendor = that.mapData[i];

                if (that.rectContains(vendor.id, vendor.r, x, y)) {
                    that.showDetails(vendor);
                    break;
                }
            }
        }

        this.mouseUp = function (e) {
            if (!that.isMouseDown) {
                return false;
            }

            that.notFirst = true;
            that.isMouseDown = false;

            if (!that.didMouseMove) {
                that.findHitTarget(that.zoom, that.lastX, that.lastY);
                return false;
            }

            var deltaX = -(that.lastX - that.downX);
            var deltaY = -(that.lastY - that.downY);
            var deltaTime = (that.lastTime - that.downTime);

            if (deltaX || deltaY) {
                // We have movement. We need to smooth scroll

                // Let our animation run until the speed is less than something
                var decayFactor = 0.85;
                var decay = decayFactor;
                deltaX = deltaX * (20 / deltaTime);
                deltaY = deltaY * (20 / deltaTime);

                var count = 1;

                clearInterval(that.animationInterval);
                that.animationInterval = setInterval(function () {
                    var xScroll = decay * deltaX;
                    var yScroll = decay * deltaY;

                    that.handleScroll(xScroll, yScroll);
                    decay = decay * decayFactor;

                    if (Math.abs(xScroll) < 1 && Math.abs(yScroll) < 1) {
                        clearInterval(that.animationInterval);
                    }

                    count++;
                }, 10);
            }

            return false;
        }

        this.mouseMove = function (e) {
            if (that.isMouseDown) {
                that.didMouseMove = true;
                that.handleScroll(that.lastX - e.pageX, that.lastY - e.pageY);

                that.lastX = e.pageX;
                that.lastY = e.pageY;
                that.lastTime = e.timeStamp;

                if (e.timeStamp - that.downTime > 150) {
                    that.downX = e.pageX;
                    that.downY = e.pageY;
                    that.downTime = e.timeStamp;
                }

                that.doRenderCanvas();
            }

            return false;
        }

        this.handleScroll = function (deltaX, deltaY) {
            that.scrollX += deltaX;
            that.scrollY += deltaY;

            var maxRowsOrCols = Math.pow(2, that.zoom) + 0.5;

            var maxWidth = (256 * maxRowsOrCols - that.width) / 2;
            var maxHeight = (256 * maxRowsOrCols - that.height) / 2;

            maxWidth = Math.max(maxWidth, that.width / 4);
            maxHeight = Math.max(maxHeight, that.height / 4);

            that.scrollX = Math.max(that.scrollX, -maxWidth);
            that.scrollX = Math.min(that.scrollX, maxWidth);

            that.scrollY = Math.max(that.scrollY, -maxHeight);
            that.scrollY = Math.min(that.scrollY, maxHeight);

            that.doRenderCanvas();
        }

        this.renderCanvas = function () {
            clearTimeout(that.renderTimeout);
            that.renderTimeout = setTimeout(that.doRenderCanvas, 10);
        }

        this.doRenderCanvas = function () {
            that.performRenderCanvas(that.zoom, that.scrollX, that.scrollY, false);
        }

        this.performRenderCanvas = function (zoom, scrollX, scrollY, skipRender) {
            // number of images in the grid (2^zoom)-1

            var maxRowsOrCols = Math.pow(2, zoom);
            var centerTile = maxRowsOrCols / 2;

            var imageCols = that.width / 256;
            var imageRows = that.height / 256;

            var colOffset = scrollX / 256;
            var rowOffset = scrollY / 256;

            // The tiles are inverted about the y-axis
            // Let's flip them here
            var startRow = rowOffset + centerTile - imageRows / 2;
            var endRow = rowOffset + centerTile + imageRows / 2 - 1;

            var startCol = colOffset + centerTile - imageCols / 2;
            var endCol = colOffset + centerTile + imageCols / 2 - 1;

            startRow = Math.floor(Math.max(0, startRow));
            endRow = Math.ceil(Math.min(maxRowsOrCols - 1, endRow));

            startCol = Math.floor(Math.max(0, startCol));
            endCol = Math.ceil(Math.min(maxRowsOrCols - 1, endCol));

            var maxRowsOrColsHigher = Math.pow(2, zoom - 1);
            var centerTileHigher = maxRowsOrColsHigher / 2;

            that.ctx.globalAlpha = 1;
            if (zoom > 0/* && !that.allLoaded*/) {
                var startX = that.centerX - scrollX - (centerTile - startCol) * 256;
                var startY = that.centerY - scrollY - (centerTile - startRow) * 256;

                var startX = that.centerX - (scrollX) - (centerTileHigher - (startCol >> 1)) * 512;
                var startY = that.centerY - (scrollY) - (centerTileHigher - (startRow >> 1)) * 512;
                var x = startX;
                var y = startY;

                for (var row = startRow >> 1; row <= Math.ceil(endRow / 2); ++row) {
                    x = startX;
                    for (var col = startCol >> 1; col <= Math.ceil(endCol / 2); ++col) {
                        //document.getElementById('blah').innerHTML = startCol + "-" + endCol + "," + startRow + "-" + endRow + "  --  " + (startCol >> 1) + "," + Math.ceil(endCol / 2) + "  -  " + (startRow >> 1) + "," + Math.ceil(endRow / 2) + "  -  " + row + "," + col;
                        var needsDraw = false;
                        for (var i = 0; i < 2; ++i) {
                            for (var j = 0; j < 2; ++j) {
                                var tile = that.getImageUrlAtZoom(zoom, row * 2 + j, col * 2 + i);

                                if (!that.imgs[tile] || !that.imgs[tile].loaded) {
                                    needsDraw = true;
                                    break;
                                }
                            }
                        }

                        if (needsDraw && !skipRender) {
                            // render the higher tile
                            var tile = that.getImageUrlAtZoom(zoom - 1, row, col);

                            if (that.imgs[tile] && that.imgs[tile].loaded) {
                                that.ctx.drawImage(that.imgs[tile], x, y, 512, 512);
                            }
                            else {
                                that.ctx.fillStyle = '#f7f7f7';
                                that.ctx.fillRect(x, y, 512, 512);
                            }
                        }

                        x += 512;
                    }

                    y += 512;
                }
            }

            if (that.zoom > 1) {
                that.allLoaded = true;
                //that.ctx.globalAlpha = 0.25;
            }
            else {
                that.allLoaded = true;
            }

            var startX = that.centerX - scrollX - (centerTile - startCol) * 256;
            var startY = that.centerY - scrollY - (centerTile - startRow) * 256;
            var x = startX;
            var y = startY;

            // we need to clear the parts not being drawn
            var minX = x;
            var minY = y;
            var maxX = startX + 256 * (endCol - startCol + 1);
            var maxY = startY + 256 * (endRow - startRow + 1);

            for (var row = startRow; row <= endRow; ++row) {
                x = startX;

                for (var col = startCol; col <= endCol; ++col) {
                    //document.getElementById('blah').innerHTML = startCol + "," + endCol + "  -  " + startRow + "," + endRow + "  -  " + row + "," + col;

                    var tile = that.getImageUrlAtZoom(zoom, row, col);

                    that.getImageAtZoom(tile);

                    if (!skipRender) {
                        if ((!that.imgs[tile] || !that.imgs[tile].loaded) && zoom == 0) {
                            that.ctx.fillStyle = '#f7f7f7';
                            that.ctx.fillRect(x, y, 256, 256);
                        }

                        if (that.imgs[tile] && that.imgs[tile].loaded) {
                            that.ctx.drawImage(that.imgs[tile], x, y, 256, 256);
                        }
                        else {
                            // find the 4 images at a zoom above...
                            that.allLoaded = false;
                        }
                    }

                    x += 256;
                }

                y += 256;
            }

            that.ctx.fillStyle = '#fff';

            if (minY > 0) {
                that.ctx.fillRect(0, 0, that.width, minY);
            }
            if (minX > 0) {
                that.ctx.fillRect(0, 0, minX, that.height);
            }
            if (maxY < that.height) {
                that.ctx.fillRect(0, maxY, that.width, that.height - maxY);
            }
            if (maxX < that.width) {
                that.ctx.fillRect(maxX, 0, that.width - maxX, that.height);
            }
        }

        this.getImageUrlAtZoom = function (zoom, row, col) {
            var extension = that.offlineMode ? '.base64?' : '.png?';
            return "/" + (zoom) + "/" + (col) + "/" + (row) + extension;
        }

        this.getImageAtZoom = function (url) {
            if (!that.imgs[url]) {
                var xhReq = new XMLHttpRequest();
                that.imgs[url] = new Image();
                that.imgs[url].onload = function () { that.imgs[url].loaded = 1; that.renderCanvas(); }

                if (that.offlineMode) {
                    var data = localStorage.getItem(url);
                    if (data) {
                        that.imgs[url].src = 'data:image/png;base64,' + data;
                    }
                    else {
                        xhReq.open("GET", url, true);
                        xhReq.onreadystatechange = function () {
                            if (xhReq.readyState != 4) { return; }

                            try {
                                localStorage.setItem(url, xhReq.responseText);
                            }
                            catch (e) {
                                // cache is full
                            }
                            that.imgs[url].src = 'data:image/png;base64,' + xhReq.responseText;
                        };

                        xhReq.send(null);
                    }
                }
                else {
                    that.imgs[url].src = url;
                }
            }
        }
    }

    window.BigZoom = BigZoom;
}
)();