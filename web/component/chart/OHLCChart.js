import TagSelector from '../TagSelector.js';
export default {
	template: `
	<div :style="style" v-observe-visibility="{
		callback: visibilityChanged,
		debounce: 500,
		once: true,
	  }">
		<div>
			<router-link :to="'/realtime/'+stockId">{{ stockId }}</router-link> {{ stockName }} [{{ group }}] profit: {{ profit }}
			<span v-if="remainCount > 0" >
				(remain: {{ remainCount }})
			</span>
		</div>
		<div class="container">
			<div class="row align-items-center justify-content-start">
				<input type="checkbox" v-model="major" class="form-check-input">
				<tag-selector :stock-id="stockId" v-model="trendTag" />
			</div>
		</div>
		<div :id="'chart-'+ stockId" :key="stockId"></div>
	</div>`,
	components: {
		'TagSelector': TagSelector,
	},
	data() {
		return {
			stockName: '',
			group: '',
			profit: 0,
			remainCount: 0,
			trendTag: '',
		}
	},
	props: {
		stockId: {
			type: String,
			required: true
		},
		tags: {
			type: Array,
			default: []
		},
		target: {
			type: Boolean,
			default: false
		},
	},
	watch: {
		tags: {
			immediate: true,
			handler: function(v) {
				if (v.indexOf('falling') >= 0) {
					this.trendTag = 'falling';
				}
				else if (v.indexOf('jitter') >= 0) {
					this.trendTag = 'jitter';
				}
				else if (v.indexOf('rising') >= 0) {
					this.trendTag = 'rising';
				}
				else {
					this.trendTag = '';
				}
			}
		}
	},
	computed: {
		major: {
			get: function ()  {return this.target;},
			set: function(v) {eel.set_major(this.stockId, v)()},
		},
		style() {
			var ret = {};

			if (this.trendTag === 'rising') {
				ret['background-color'] = '#fff3f3';
			}
			if (this.trendTag === 'jitter') {
				ret['background-color'] = '#fffff3';
			}
			if (this.trendTag === 'falling') {
				ret['background-color'] = '#f3fff3';
			}

			return ret;
		},
	},
	methods: {
		visibilityChanged(isVisible, entry) {
			if (isVisible) {
				this.plot(this.stockId);
			}
		},
		mean(items) {
			if (items.length===0) {return 0;}
			return items.reduce(function(s, v){return s+v;}, 0) / items.length;
		},
		getBollingerBands(n, k, data) {
			var ma = [];
			var low = [];
			var high = [];
			for (var i = n - 1, len = data.length; i < len; i++) {
				var slice = data.slice(i + 1 - n , i);
				var mean = this.mean(slice);
				var stdDev = Math.sqrt(this.mean(slice.map(function(d) {
					return Math.pow(d - mean, 2);
				})));
				ma.push(mean);
				low.push(mean - (k * stdDev));
				high.push(mean + (k * stdDev));
			}
			return {
				ma,
				low,
				high
			}
		},
		getMovingAverage(n, data) {
			var ma = [];
			for (var i = n - 1, len = data.length; i < len; i++) {
				var slice = data.slice(i + 1 - n , i + 1);
				var mean = this.mean(slice);
				ma.push(mean);
			}
			return ma
		},
		async plot(stockId) {
			var result = await eel.list_trade(stockId)();
			this.stockName = result.name;
			this.group = this.tags[0];
			var trace1 = {
				type: 'candlestick', 
				xaxis: 'x', 
				yaxis: 'y',
				decreasing: {line: {color: '#7F7F7F'}}, 
				increasing: {line: {color: '#17BECF'}},
				line: {color: 'rgba(31,119,180,1)'},
				x: result.data.date,
				low: result.data.low,
				high: result.data.high,
				open: result.data.open,
				close: result.data.close,
			};
			var bband = this.getBollingerBands(15, 2, result.data.close);
			var bband_ma = {
			  x: result.data.date.slice(15),
			  y: bband.ma,
			  yaxis: 'y',
			  type: 'scatter',
			  hoverinfo: 'skip',
			  line: {color: 'rgba(220,100,0,0.5)'},
			};
			var bband_low = {
			  x: result.data.date.slice(15),
			  y: bband.low,
			  yaxis: 'y',
			  type: 'scatter',
			  hoverinfo: 'skip',
			  line: {color: 'rgba(0,255,0,0.5)'},
			};
			var bband_high = {
			  x: result.data.date.slice(15),
			  y: bband.high,
			  yaxis: 'y',
			  type: 'scatter',
			  hoverinfo: 'skip',
			  line: {color: 'rgba(255,0,0,0.5)'},
			};
			var avg1 = {
			  x: result.data.date.slice(6),
			  y: this.getMovingAverage(7, result.data.close),
			  yaxis: 'y',
			  type: 'scatter',
			  hoverinfo: 'skip',
			  line: {color: 'rgba(255,0,0,0.5)'},
			};
			var avg2 = {
			  x: result.data.date.slice(13),
			  y: this.getMovingAverage(14, result.data.close),
			  yaxis: 'y',
			  type: 'scatter',
			  hoverinfo: 'skip',
			  line: {color: 'rgba(220,100,0,0.5)'},
			};
			var avg3 = {
			  x: result.data.date.slice(20),
			  y: this.getMovingAverage(21, result.data.close),
			  yaxis: 'y',
			  type: 'scatter',
			  hoverinfo: 'skip',
			  line: {color: 'rgba(0,255,0,0.5)'},
			};
			// var in_market = {
			//   x: result.total_trades.date,
			//   y: result.total_trades.value,
			//   yaxis: 'y2',
			//   type: 'scatter'
			// };
			var invester = {
			  x: result.invester.date,
			  y: result.invester.percent,
			  yaxis: 'y2',
			  type: 'scatter',
			  line: {color: 'rgba(80,0,180, 0.5)'},
			};

			var data = [trace1, avg1, avg2, avg3,invester];

			var layout = {
				height: 300,
				dragmode: 'zoom', 
				margin: {
					r: 60, 
					t: 25, 
					b: 40, 
					l: 60
				},
				plot_bgcolor: 'rgba(0,0,0,0)',
				paper_bgcolor: 'rgba(0,0,0,0)',
				showlegend: false, 
				xaxis: {
					autorange: true,
					title: 'Date', 
					type: 'date'
				}, 
				yaxis: {
					autorange: true, 
					type: 'linear'
				},
				yaxis2: {
				  autorange: true, 
				  //anchor: 'free',
				  overlaying: 'y',
				  side: 'right'
				},
				annotations: [],
				shapes: []
			};

			var sells = [];
			var buys = [];
			this.remainCount = 0;
			this.profit = 0;
			result.trades.forEach((trade) => {
				this.profit -= trade[2];
				if (trade[1] > 0) {
					this.remainCount += trade[1];
					for (var i=0; i < trade[1]/1000; i++) {
						buys.push([trade[0], trade[2] / trade[1]]);
					}
				} else {
					this.remainCount += trade[1];
					for (var i=0; i < -trade[1]/1000; i++) {
						sells.push([trade[0], trade[2] / trade[1]]);
					}
				}
			});

			if (this.remainCount > 0) {
				this.profit += result.data.close[result.data.close.length - 1] * this.remainCount;
			}

			while (buys.length > 0 && sells.length > 0) {
				var buy = buys.shift();
				var sell = sells.shift();
				if (buy[0] == sell[0]) {
					var diff = parseFloat((buy[1] - sell[1]).toFixed(1));
					layout.annotations.push({
						x: buy[0],
						y: diff > 0 ? sell[1] : buy[1],
						xref: 'x',
						yref: 'y',
						text: diff,
						font: {color: 'magenta'},
						showarrow: true,
						yanchor: diff > 0 ? 'bottom' : 'top',
						ax: 0,
						ay: diff
					});
					continue;
				} else {
					layout.shapes.push({
						type: 'line',
						xref: 'x',
						yref: 'y',
						x0: buy[0],
						y0: buy[1],
						x1: sell[0],
						y1: sell[1],
						opacity: 0.8,
						line: {
							color: '#000000',
							width: 2
						}
					});
				}
			}

			var fig = await Plotly.newPlot('chart-' + this.stockId, data, layout);
			fig.on('plotly_relayout', (event) => {
				var fromX, toX;
				if ("xaxis.range[0]" in event  && "xaxis.range[1]" in event) {
					fromX = new Date(event["xaxis.range[0]"]);
					toX = new Date(event["xaxis.range[1]"]);
				} else if ("xaxis.range" in event) {
					fromX = new Date(event["xaxis.range"][0]);
					toX = new Date(event["xaxis.range"][1]);
				} else if ("xaxis.autorange" in event && event["xaxis.autorange"]) {
					fromX = new Date(data[0].x[0]);
					toX = new Date(data[0].x[data[0].x.length - 1]);
				} else {
					return;
				}
				var minY = Infinity, maxY = 0;
				data[0].x.forEach((d, i) => {
					var date = new Date(d);
					if (date < fromX || date > toX) {
						return;
					}
					if (data[0].high[i] > maxY) {
						maxY = data[0].high[i];
					}
					if (data[0].low[i] < minY) {
						minY = data[0].low[i];
					}
				});
				Plotly.relayout(fig, {
					'yaxis.range': [minY, maxY]
				});
			});
			function addDays(date, days) {
				var result = new Date(date);
				result.setDate(result.getDate() + days);
				return result;
			}
			Plotly.relayout(fig, {'xaxis.range': [addDays(new Date(), -21), new Date()]})
			// fig.layout.onchange = () => {
			// 	console.info(arguments)
			// 	// in_view = df.loc[fig.layout.xaxis.range[0]:fig.layout.xaxis.range[1]]
    		// 	// fig.layout.yaxis.range = [in_view.High.min() - 10, in_view.High.max() + 10]E
			// };
		}
	}
};
