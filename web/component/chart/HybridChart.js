function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

export default {
	template: `
	<div :style="style" v-observe-visibility="{
		callback: visibilityChanged,
		debounce: 500,
		once: true,
	  }">
		<div><router-link :to="link">{{ title }}</router-link> ({{(trend*100).toFixed(1)}}%)</div>
		<div :id="'hybrid-'+ chartId" :key="chartId" style="flex-grow: 1;"></div>
	</div>`,
	emits: ['trend-change'],
	components: {
	},
	data() {
		return {
			chartId: makeid(6),
			current: {
				time: [],
				value: [],
			},
		}
	},
	props: {
		title: {
			type: String,
			default: ''
		},
		link: {
			type: String,
			default: ''
		},
		history: {
			type: Object,
			default: {}
		},
	},
	watch: {
		trend: {
			immediate: true,
			handler(newVal, oldVal) {
				if (newVal !== oldVal) {
					this.$emit('trend-change');
				}
			}
		},
		realtime: {
			immediate: true,
			handler(new_val, oldVal) {
				var self = this;
				this.$nextTick(() => {
					self.plot();
				});
			}
		},
	},
	computed: {
		realtime() {
			if (this.current.time.length > 0) {
				return {
					time: this.current.time.slice(0),
					value: this.current.value.slice(0),
				};
			}
			else {
				const raw_time = Object.assign([], this.history.time);
				const raw_value = Object.assign([], this.history.value);
				var realtime_until = new Date(Math.max.apply(null, this.history.time));
				realtime_until.setHours(13);
				realtime_until.setMinutes(30);
				realtime_until.setSeconds(0);
				var realtime_since = new Date(realtime_until);
				realtime_since.setHours(9);
				realtime_since.setMinutes(0);
				realtime_since.setSeconds(0);
				var realtime_idx = raw_time.reduce((idx_list, d, idx) => {
					if (d >= realtime_since && d <= realtime_until) {
						idx_list.push(idx);
					}
					return idx_list;
				}, []);
				return {
					time: realtime_idx.map((idx) => raw_time[idx]),
					value: realtime_idx.map((idx) => raw_value[idx]),
				};
			}
		},
		trend() {
			if (this.realtime.value.length < 2) {
				return 0;
			}

			var firstData = this.realtime.value[0];
			var lastData = this.realtime.value[this.realtime.value.length - 1];

			return (lastData - firstData) / firstData;
		},
		style() {
			var ret = {
				'display': 'flex',
				'flex-direction': 'column',
				'background-color': '#fffff3',
			};
			if (this.trend > 0) {
				ret['background-color'] = '#fff3f3';
			}
			if (this.trend < 0) {
				ret['background-color'] = '#f3fff3';
			}

			return ret;
		},
	},
	methods: {
		visibilityChanged(isVisible, entry) {
			if (isVisible) {
				this.plot();
			}
		},
		formatDate(d) {
			return d.getFullYear() + ("0" + d.getDate()).slice(-2) + ("0"+(d.getMonth()+1)).slice(-2)
		},
		getDailyKLineData(times, values) {
			var dates = [];
			return times.reduce((r, t, i) => {
				var dateStr = this.formatDate(new Date(t));
				var value = values[i];
				var idx = dates.indexOf(dateStr);
				if (0 > idx) {
					idx = dateStr.length;
					dates.push(dateStr);
					r.push({
						time: t,
						open: value,
						close: value,
						low: value,
						high: value,
					});
				}
				else {
					r[idx].close = value;
					if (r[idx].low > value) {
						r[idx].low = value;
					}
					if (r[idx].high < value) {
						r[idx].high = value;
					}
				}
				return r;
			}, []);
		},
		createKLines(since_time, until_time, history) {
			var shapes = [];
			var interval = (until_time - since_time) / history.length;
			var center = since_time + interval/2;

			for (var kLineData of history) {
				var color = kLineData.open>kLineData.close?'#00FF00':'#FF0000';
				shapes.push({
					type: 'line',
					layer: 'below',
					xref: 'x',
					yref: 'y',
					x0: center,
					y0: kLineData.low,
					x1: center,
					y1: kLineData.high,
					opacity: 0.3,
					line: {
						color: color,
						width: 2
					}
				});
				shapes.push({
					type: 'rect',
					layer: 'below',
					xref: 'x',
					yref: 'y',
					x0: center - interval/2,
					y0: Math.max(kLineData.open, kLineData.close),
					x1: center + interval/2,
					y1: Math.min(kLineData.open, kLineData.close),
					fillcolor: color,
					opacity: 0.3,
					line: {
						width: 0
					}
				});
				center += interval;
			}
			return shapes;
		},
		mean(items, range) {
			if (items.length===0) {return 0;}
			return items.reduce(function(s, v, i){
				if (i < items.length - range) {
					return s;
				}
				else {
					return s+v;
				}
			}, 0) / range;
		},
		getOpenTime(date) {
			var since = new Date(date);
			since.setHours(9);
			since.setMinutes(0);
			since.setSeconds(0);
			var until = new Date(date);
			return [since.getTime(), until.getTime()];
		},
		async plot() {
			var self = this;
			var values = {
			  x: this.realtime.time,
			  y: this.realtime.value,
			  yaxis: 'y',
			  type: 'scatter',
			  line: {color: 'rgba(80,0,180,0.5)'},
			};
			var [since_time, until_time] = this.getOpenTime(this.realtime.time[this.realtime.time.length - 1]);
			var history_data = this.history.time.reduce((r, t, i) => {
				if (t < since_time) {
					r.time.push(t);
					r.value.push(self.history.value[i]);
				}

				return r;
			}, {
				time: [],
				value: [],
			});
			var kLineDatas = this.getDailyKLineData(history_data.time, history_data.value);
			var shapes = this.createKLines(
				since_time,
				until_time,
				kLineDatas,
			);

			var close_series = kLineDatas.map(d => d.close);
			shapes.push({
				type: 'line',
				xref: 'x',
				yref: 'y',
				x0: since_time,
				y0: this.mean(close_series, 7),
				x1: until_time,
				y1: this.mean(close_series, 7),
				line: {color: 'rgba(255,0,0,0.5)'},
			}, {
				type: 'line',
				xref: 'x',
				yref: 'y',
				x0: since_time,
				y0: this.mean(close_series, 14),
				x1: until_time,
				y1: this.mean(close_series, 14),
				line: {color: 'rgba(220,100,0,0.5)'},
			}, {
				type: 'line',
				xref: 'x',
				yref: 'y',
				x0: since_time,
				y0: this.mean(close_series, 21),
				x1: until_time,
				y1: this.mean(close_series, 21),
				line: {color: 'rgba(0,255,0,0.5)'},
			});

			var data = [values];
			var layout = {
				dragmode: 'zoom', 
				margin: {
					r: 30, 
					t: 12, 
					b: 20, 
					l: 30
				},
				plot_bgcolor: 'rgba(0,0,0,0)',
				paper_bgcolor: 'rgba(0,0,0,0)',
				showlegend: false, 
				xaxis: {
					autorange: true,
					showticklabels: false,
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
				shapes: shapes,
			};

			const config = {
				displayModeBar: false, // this is the line that hides the bar.
			};

			var fig = await Plotly.newPlot('hybrid-' + this.chartId, data, layout, config);
			fig.on('plotly_relayout', (event) => {
				var fromX, toX;
				if ("xaxis.range[0]" in event  && "xaxis.range[1]" in event) {
					fromX = new Date(event["xaxis.range[0]"]);
					toX = new Date(event["xaxis.range[1]"]);
				} else if ("xaxis.range" in event) {
					fromX = new Date(event["xaxis.range"][0]);
					toX = new Date(event["xaxis.range"][1]);
				} else if ("xaxis.autorange" in event && event["xaxis.autorange"]) {
					[fromX, toX] = [new Date(since_time), new Date(until_time)];
				} else {
					return;
				}
				var minY = Infinity, maxY = 0;
				data[0].x.forEach((d, i) => {
					var date = new Date(d);
					if (date < fromX || date > toX) {
						return;
					}
					if (data[0].y[i] > maxY) {
						maxY = data[0].y[i];
					}
					if (data[0].y[i] < minY) {
						minY = data[0].y[i];
					}
				});
				Plotly.relayout(fig, {
					'yaxis.range': [minY, maxY]
				});
			});
			Plotly.relayout(fig, {'xaxis.range': [since_time, until_time]});
			// fig.layout.onchange = () => {
			// 	console.info(arguments)
			// 	// in_view = df.loc[fig.layout.xaxis.range[0]:fig.layout.xaxis.range[1]]
    		// 	// fig.layout.yaxis.range = [in_view.High.min() - 10, in_view.High.max() + 10]E
			// };
		}
	}
};
