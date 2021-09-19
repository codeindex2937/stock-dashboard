import eel
import os
import json
from datetime import datetime
from datetime import timedelta, datetime

from tasq.stock.service import DB, AnalyzeDB
from tasq.stock.worker import parseTrades, Store
from app_utils import getGroupHistory, getStockRealtime, getGroupRealtime

class Store:
	def __init__(self):
		self.history = []

	def buy(self, date, count, value):
		self.history.append((date, count, value))

	def sell(self, date, count, value):
		self.history.append((date, -count, -value))

	def remain_count(self):
		return sum([h[1] for h in self.history])

	def profit(self, price):
		remain_value = sum([h[2] for h in self.history])
		return self.remain_count() / 1000 * price - remain_value

	def accum(self, until):
		date = self.history[0][0]
		accum_result = list()
		accum_value = 0
		current_date = 0
		for date, count, value in self.history:
			if date > until:
				break
			if date != current_date:
				accum_result.append((current_date, accum_value))
				current_date = date
			accum_value += value
		accum_result.append((current_date, accum_value))
		return accum_result[1:]

db = DB()
db.connect('stock.db')
analyze_db = AnalyzeDB()
analyze_db.connect('analyze.db')

stock_list = db.list_stock()
last_trade_map = {trade['stock_id']: trade for trade in db.list_last_trade()}
stock_id_map = {stock['id']: stock for stock in stock_list}

trades_file = 'trades.txt'
trades_map = {}
total_store = Store()
total_history = []
if os.path.isfile(trades_file):
	trades_map, total_store = parseTrades(trades_file, db)
	total_history = total_store.accum(total_store.history[-1][0])

@eel.expose
def list_stock():
	global db, analyze_db, last_trade_map

	for c in db.list_trade_count():
		if c[0] in last_trade_map:
			last_trade_map[c[0]]['trade_count'] = c[1]

	output_list = []
	for stock in stock_list:
		stock_id = stock['stock_id']
		if stock_id not in last_trade_map:
			continue
		if last_trade_map[stock_id]['close_price'] is None:
			continue
		if last_trade_map[stock_id]['close_price']  < 100:
			continue
		data = {}
		data.update(stock)
		data.update(last_trade_map[stock_id])
		data['has_trade'] = stock_id in trades_map
		output_list.append(data)

	return [{
		'stock_id': stock['id'],
		'stock_name': stock['name'],
		'open_price': stock['open_price'],
		'close_price': stock['close_price'],
		'highest_price': stock['highest_price'],
		'lowest_price': stock['lowest_price'],
		'has_trade': stock['has_trade'],
	} for stock in output_list]

@eel.expose
def list_trade(stock_id):      
	global db, trades_map
	cache_path = os.path.join('cache/single_cache', stock_id)
	last_trade_date = max([trade['date'] for trade in last_trade_map.values()])
	if os.path.isfile(cache_path):
		with open(cache_path, 'r') as f:
			result = json.load(f)
			if stock_id in last_trade_map:
				last_trade_date = last_trade_map[stock_id]['date']

			if result['date'] == datetime.strftime(last_trade_date, '%Y-%m-%d'):
				return result

	since = last_trade_date + timedelta(days=-120)
	date_filter = "date BETWEEN '{}' AND '{}'".format(datetime.strftime(since, '%Y-%m-%d'), datetime.strftime(last_trade_date, '%Y-%m-%d'))
	trades = db.list_trade({'stock_id': stock_id}, extra=date_filter)
	stock = stock_id_map.get(str(stock_id), {})

	result = {
		'date': datetime.strftime(last_trade_date, '%Y-%m-%d'),
		'name': stock['name'],
		'data': {
			'date': [datetime.strftime(trade['date'], '%Y-%m-%d') for trade in trades],
			'open': [trade['open_price'] for trade in trades],
			'close': [trade['close_price'] for trade in trades],
			'low': [trade['lowest_price'] for trade in trades],
			'high': [trade['highest_price'] for trade in trades],
		},
		'invester': {
			'date': [datetime.strftime(info['date'], '%Y-%m-%d') for info in trades],
			'percent': [info['hold_by_foreign_percent'] for info in trades],
		},
		'margin': {
			'date': [datetime.strftime(info['date'], '%Y-%m-%d') for info in trades],
			'purchase_balance': [info['margin_purchase_today_balance'] for info in trades],
			'short_sale_balance': [info['short_sale_today_balance'] for info in trades],
		},
		'trades': []
	}
	if stock_id in trades_map:
		result['trades'].extend(trades_map[stock_id].history)

	with open(cache_path, 'w') as f:
		json.dump(result, f)

	return result

@eel.expose
def list_target(tags):
	stocks = analyze_db.list_by_tag(*tags)
	for stock in stocks:
		stock['last_close'] = last_trade_map.get(stock['stock_id'], {'close_price': 0})['close_price']
	return stocks

@eel.expose
def get_stock(stock_id):
	return {
		'tags': analyze_db.list_tag_of_stock(stock_id),
	}

@eel.expose
def list_tag():
	return analyze_db.list_tag()

@eel.expose
def set_major(stock_id, set_major):
	if set_major:
		analyze_db.set_tag(stock_id, "major")
	else:
		analyze_db.reset_tag(stock_id, "major")

@eel.expose
def update_tag(stock_id, tag_symbol):
	return analyze_db.update_stock_tag(stock_id, tag_symbol)

@eel.expose
def get_group_history():
	since_date = datetime.now() - timedelta(days=7)

	concat_group_data = {}
	for single_date in (since_date + timedelta(days=n) for n in range(8)):
		date_str = datetime.strftime(single_date, '%Y%m%d')
		cache_path = os.path.join('cache/group_cache', date_str)

		if os.path.isfile(cache_path):
			with open(cache_path, 'r') as f:
				group_data = json.load(f)['data']
		else:
			group_data = getGroupHistory(single_date)
			for key, group in group_data.items():
				group_data[key]['time'] = list(map(lambda t: t.timestamp() * 1000.0, group['time']))

			with open(cache_path, 'w') as f:
				json.dump({'type': 'history', 'data': group_data}, f)

		if len(group_data) < 0:
			continue

		for key, group in group_data.items():
			concat_group_data.setdefault(key, {
				'title': group['title'],
				'id': group['id'],
				'key': key,
				'time': [],
				'value': []
			})
			concat_group_data[key]['time'].extend(group['time'])
			concat_group_data[key]['value'].extend(group['value'])

	return concat_group_data

@eel.expose
def get_group_realtime():
	date_str = datetime.now().strftime('%Y%m%d')
	cache_path = os.path.join('cache/group_cache', date_str)
	cache = {}
	series_cache = {}
	if os.path.isfile(cache_path):
		with open(cache_path, 'r') as f:
			cache = json.load(f)
	if cache.get('type', '') == 'history':
		os.remove(cache_path)
	else:
		series_cache = cache['data']

	current = getGroupRealtime()
	for k, data in current.items():
		series_cache.setdefault(k, {
			'title': '',
			'id': '',
			'time': [],
			'value': []
		})
		series_cache[k]['title'] = data['title']
		series_cache[k]['id'] = data['id']
		if data['current'] is not None:
			series_cache[k]['time'].append(data['time'])
			series_cache[k]['value'].append(data['current'])
		
	with open(cache_path, 'w') as f:
		json.dump({'type': 'realtime', 'data': series_cache}, f)

	return series_cache

@eel.expose
def get_stock_realtime(stock_ids):
	stock_datas = getStockRealtime(stock_ids)
	result = {}

	date_str = stock_datas['time'].strftime('%Y%m%d')
	for stock_id in stock_ids:
		if stock_id not in stock_datas:
			continue
		stock_data = stock_datas[stock_id]
		cache_path = os.path.join('cache/realtime_cache', stock_id)
		series = {
			'date': date_str,
			'time': [],
			'value': [],
		}
		if os.path.isfile(cache_path):
			with open(cache_path, 'r') as f:
				series_cache = json.load(f)
				if series_cache['date'] == date_str:
					series = series_cache

		series['time'].append(stock_datas['time'].timestamp() * 1000)
		series['value'].append(stock_data['current'])
		with open(cache_path, 'w') as f:
			json.dump(series, f)
		result[stock_id] = series
	return result

for path in ('single_cache', 'group_cache', 'realtime_cache'):
	try:
		os.makedirs(os.path.join('cache', path))
	except:
		pass

eel.init('web') # eel.init(網頁的資料夾)
eel.start('index.html', size = (1200,800))