"use strict";
class Chart {
    constructor(dataLink) {
        this.dataLink = dataLink;
        this.data = null;
        this.itemWidth = 80;
        this.range = 0.0004;
        this.heightOfOneY = 100;
        this.candleWidth = 50;
        this.scrollLeft = 0;
        this.isDragging = false;
        this.startX = 0;
        this.perTime = 1;
        this.length = 0;
        this.windowWidth = window.innerWidth - 16;
        this.bottomBorder = 25;
        this.height = 500;
        this.priceBlockWidth = 50;
        this.zoomLevel = 0.1;
        this.zoomFactor = 0.1;
        this.yRows = 1;
        this.canvas = document.getElementById('chart');
        this.ctx = this.canvas.getContext('2d');
        this.windowWidthWithoutRightBorder = this.windowWidth - this.priceBlockWidth;
        this.canvas.width = this.windowWidth;
        this.canvas.height = this.height;
        this.setEventListeners();
        this.setDPR();
        this.fetchData();
    }
    setDPR() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.scale(dpr, dpr);
    }
    async fetchData() {
        try {
            const response = await fetch(this.dataLink);
            const data = await response.json();
            this.processData(data[0]);
        }
        catch (error) {
            console.error('Error:', error);
        }
    }
    processData(dataFromRequest) {
        this.data = dataFromRequest;
        this.length = dataFromRequest.Bars.length;
        this.drawChart();
    }
    setEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        this.canvas.addEventListener('wheel', (e) => this.handleZoom(e));
    }
    handleMouseDown(e) {
        this.isDragging = true;
        this.startX = e.clientX;
        this.canvas.style.cursor = 'grabbing';
    }
    handleMouseMove(e) {
        if (this.isDragging && this.canvas) {
            const fullWidth = (this.length * this.itemWidth) / this.perTime;
            if (this.scrollLeft <= 0 && this.startX < e.clientX) {
                this.isDragging = false;
                this.scrollLeft = 0;
            }
            else if (this.scrollLeft + this.windowWidth >= fullWidth && this.startX > e.clientX) {
                this.isDragging = false;
                this.scrollLeft = (fullWidth - this.windowWidth) + this.itemWidth / this.perTime;
            }
            else {
                const deltaX = this.startX - e.clientX;
                this.scrollLeft += deltaX;
            }
            this.drawChart();
        }
    }
    handleMouseUp() {
        this.isDragging = false;
        this.canvas.style.cursor = 'crosshair';
    }
    handleMouseLeave() {
        this.isDragging = false;
        this.canvas.style.cursor = 'crosshair';
    }
    handleZoom(e) {
        e.preventDefault();
        // Save the current mouse position
        const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
        const direction = Math.sign(e.deltaY);
        const newZoomLevel = this.zoomLevel + (direction * this.zoomFactor);
        this.zoomLevel = Math.max(this.zoomFactor, Math.min(5, newZoomLevel));
        if ((this.zoomLevel === 0.1 && this.perTime === 1) || this.zoomLevel === 5)
            return; // Prevent zooming too far out or in
        // Update itemWidth and candleWidth based on zoom level
        this.itemWidth = 80 * this.zoomLevel;
        this.candleWidth = 50 * this.zoomLevel;
        this.perTime = Math.max(1, this.perTime + direction);
        this.itemWidth = Math.max(80, Math.min(140, this.itemWidth));
        this.candleWidth = Math.max(2, (Math.min(50, (this.itemWidth / this.perTime) - 2)));
        // Calculate the new scrollLeft position based on the mouse pointer
        const newScrollLeft = (this.scrollLeft + mouseX) * (this.zoomLevel / this.zoomLevel - direction) - mouseX;
        // Update the scrollLeft position
        this.scrollLeft = Math.max(0, Math.min(newScrollLeft, (this.length * this.itemWidth / this.perTime) - this.windowWidth));
        this.drawChart();
    }
    drawChart() {
        if (!this.data)
            return;
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBottomLine();
        const itemsInScroll = Math.floor(this.scrollLeft / this.itemWidth);
        const startIndex = Math.max(0, this.perTime * itemsInScroll);
        const endIndex = Math.min(this.length, this.perTime * Math.floor((this.scrollLeft + this.windowWidthWithoutRightBorder) / this.itemWidth));
        const { maxPrice, priceRange } = this.getPriceRange(startIndex, endIndex);
        this.yRows = Math.ceil(priceRange / this.range) + 1;
        this.heightOfOneY = (this.height - this.bottomBorder) / this.yRows;
        const x = (itemsInScroll * this.itemWidth) - this.scrollLeft;
        this.drawXChartGrid(startIndex, endIndex, x);
        this.drawYChartGrid(maxPrice);
        this.drawCandles(maxPrice + this.range, startIndex, endIndex, x);
    }
    getPriceRange(startIndex, endIndex) {
        let maxPrice = -Infinity;
        let minPrice = Infinity;
        for (let i = startIndex; i < endIndex; i++) {
            const bar = this.data.Bars[i];
            if (bar.High > maxPrice) {
                maxPrice = bar.High;
            }
            if (bar.Low < minPrice) {
                minPrice = bar.Low;
            }
        }
        const priceRange = maxPrice - minPrice;
        return { maxPrice, priceRange };
    }
    drawCandles(currentPrice, startIndex, endIndex, x) {
        let currentStep = 0;
        for (let i = startIndex; i < endIndex; i++) {
            const width = ((this.itemWidth / this.perTime) * currentStep) + x;
            const yHeight = this.heightOfOneY;
            const howManyRowsOpen = (currentPrice - this.data.Bars[i].Open) / this.range;
            const howManyRowsClose = (currentPrice - this.data.Bars[i].Close) / this.range;
            const testOpen = howManyRowsOpen * yHeight - (this.heightOfOneY / 2);
            const testClose = howManyRowsClose * yHeight - (this.heightOfOneY / 2);
            const howManyRowsHigh = (currentPrice - this.data.Bars[i].High) / this.range;
            const howManyRowsLow = (currentPrice - this.data.Bars[i].Low) / this.range;
            const testHigh = howManyRowsHigh * yHeight - (this.heightOfOneY / 2);
            const testLow = howManyRowsLow * yHeight - (this.heightOfOneY / 2);
            const height = testClose - testOpen;
            this.ctx.fillStyle = testOpen < testClose ? '#f53636' : '#00b896';
            this.ctx.beginPath();
            this.ctx.setLineDash([]);
            this.ctx.strokeStyle = testOpen < testClose ? '#f53636' : '#00b896';
            this.ctx.moveTo(width, testOpen < testClose ? testClose : testOpen);
            this.ctx.lineTo(width, testHigh);
            this.ctx.moveTo(width, testOpen > testClose ? testClose : testOpen);
            this.ctx.lineTo(width, testLow);
            this.ctx.stroke();
            this.ctx.fillRect(width - (this.candleWidth / 2), testOpen, this.candleWidth, height === 0 ? 1 : height);
            currentStep += 1;
        }
    }
    drawXChartGrid(startIndex, endIndex, x) {
        const beginDate = new Date(this.data.ChunkStart);
        for (let i = startIndex; i < endIndex; i += this.perTime) {
            const date = new Date(beginDate.getTime() + (this.data.Bars[i].Time * 1000));
            const formattedDate = this.formatDate(date);
            this.ctx.font = "12px serif";
            this.ctx.fillStyle = "black";
            this.ctx.fillText(formattedDate, x, this.height - 10);
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#cdcdcd';
            this.ctx.setLineDash([8, 5]);
            this.ctx.moveTo(x, (this.height - this.bottomBorder) - 1);
            this.ctx.lineTo(x, 0);
            this.ctx.stroke();
            x += this.itemWidth;
        }
    }
    formatDate(date) {
        const formatter = new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        const parts = formatter.formatToParts(date);
        const day = parts.find((part) => part.type === 'day').value;
        const month = parts.find((part) => part.type === 'month').value;
        const hour = parts.find((part) => part.type === 'hour').value;
        const minute = parts.find((part) => part.type === 'minute').value;
        return `${day} ${month} ${hour}:${minute}`;
    }
    drawYChartGrid(maxPrice) {
        let y = this.heightOfOneY / 2;
        let currentPrice = maxPrice;
        for (let i = 0; i < this.yRows; i++) {
            this.ctx.fillStyle = "black";
            this.ctx.beginPath();
            this.ctx.moveTo(this.windowWidth - 70, y);
            this.ctx.fillText(currentPrice.toFixed(5).toString(), this.windowWidth - this.priceBlockWidth, y);
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#cdcdcd';
            this.ctx.setLineDash([8, 5]);
            this.ctx.moveTo(this.windowWidth - this.priceBlockWidth, y);
            this.ctx.lineTo(0, y);
            this.ctx.stroke();
            if (i !== this.yRows) {
                currentPrice -= this.range;
                y += this.heightOfOneY;
            }
        }
    }
    drawBottomLine() {
        this.ctx.beginPath();
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = 'black';
        this.ctx.moveTo(0, this.height - this.bottomBorder);
        this.ctx.lineTo(this.windowWidthWithoutRightBorder, this.height - this.bottomBorder);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = 'black';
        this.ctx.moveTo(this.windowWidthWithoutRightBorder, this.height - this.bottomBorder);
        this.ctx.lineTo(this.windowWidthWithoutRightBorder, this.height - this.bottomBorder + 5);
        this.ctx.stroke();
    }
}
new Chart(`https://beta.forextester.com/data/api/Metadata/bars/chunked?Broker=Advanced&Symbol=EURUSD&Timeframe=1&Start=57674&End=59113&UseMessagePack=false`);
