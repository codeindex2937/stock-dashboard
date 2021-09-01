import requests
import json
import csv
from datetime import datetime
from urllib.parse import urlencode
from io import StringIO

titleMap = {
	# 'tse_t011.tw': '水泥窯製',
	# 'tse_t031.tw': '塑膠化工',
	# 'tse_t051.tw': '機電',
	'tse_t01.tw': {'title': '水泥', 'id': '水泥工業'},
	'tse_t02.tw': {'title': '食品', 'id': '食品工業'},
	'tse_t03.tw': {'title': '塑膠', 'id': '塑膠工業'},
	'tse_t04.tw': {'title': '紡織纖維', 'id': '紡織纖維'},
	'tse_t05.tw': {'title': '電機機械', 'id': '電機機械'},
	'tse_t06.tw': {'title': '電器電纜', 'id': '電器電纜'},
	'tse_t07.tw': {'title': '化學生技醫療', 'id': '生技醫療業'},
	'tse_t21.tw': {'title': '化學', 'id': '化學工業'},
	'tse_t22.tw': {'title': '生技醫療', 'id': '生技醫療業'},
	'tse_t08.tw': {'title': '玻璃陶瓷', 'id': '玻璃陶瓷'},
	'tse_t09.tw': {'title': '造紙', 'id': '造紙工業'},
	'tse_t10.tw': {'title': '鋼鐵', 'id': '鋼鐵工業'},
	'tse_t11.tw': {'title': '橡膠', 'id': '橡膠工業'},
	'tse_t12.tw': {'title': '汽車', 'id': '汽車工業'},
	'tse_t13.tw': {'title': '電子', 'id': '電子零組件業'},
	'tse_t24.tw': {'title': '半導體', 'id': '半導體業'},
	'tse_t25.tw': {'title': '電腦及週邊設備', 'id': '電腦及週邊設備業'},
	'tse_t26.tw': {'title': '光電', 'id': '光電業'},
	'tse_t27.tw': {'title': '通信網路', 'id': '通信網路業'},
	'tse_t28.tw': {'title': '電子零組件', 'id': '電子零組件業'},
	'tse_t29.tw': {'title': '電子通路', 'id': '電子通路業'},
	'tse_t30.tw': {'title': '資訊服務', 'id': '資訊服務業'},
	'tse_t31.tw': {'title': '其他電子', 'id': '其他電子業'},
	'tse_t14.tw': {'title': '建材營造', 'id': '建材營造業'},
	'tse_t15.tw': {'title': '航運', 'id': '航運業'},
	'tse_t16.tw': {'title': '觀光', 'id': '觀光事業'},
	'tse_t17.tw': {'title': '金融保險', 'id': '金控業'},
	'tse_t18.tw': {'title': '貿易百貨', 'id': '貿易百貨業'},
	'tse_t23.tw': {'title': '油電燃氣', 'id': '油電燃氣業'},
	'tse_t20.tw': {'title': '其他', 'id': '其他業'},
}

def parseFloat(s):
	try:
		if type(s) == float:
			if numpy.isnan(s):
				return None
			else:
				return s
		if s.endswith('%'):
			return float(s.replace('%', '').replace(',', ''))
		else:
			return float(s.replace(',', ''))
	except:
		return None

historyDataMapping = {
	'tse_t01.tw': 5,
	'tse_t02.tw': 6,
	'tse_t03.tw': 7,
	'tse_t04.tw': 8,
	'tse_t05.tw': 9,
	'tse_t06.tw': 10,
	'tse_t07.tw': 11,
	'tse_t21.tw': 12,
	'tse_t22.tw': 13,
	'tse_t08.tw': 14,
	'tse_t09.tw': 15,
	'tse_t10.tw': 16,
	'tse_t11.tw': 17,
	'tse_t12.tw': 18,
	'tse_t13.tw': 19,
	'tse_t24.tw': 20,
	'tse_t25.tw': 21,
	'tse_t26.tw': 22,
	'tse_t27.tw': 23,
	'tse_t28.tw': 24,
	'tse_t29.tw': 25,
	'tse_t30.tw': 26,
	'tse_t31.tw': 27,
	'tse_t14.tw': 28,
	'tse_t15.tw': 29,
	'tse_t16.tw': 30,
	'tse_t17.tw': 31,
	'tse_t18.tw': 32,
	'tse_t23.tw': 33,
	'tse_t20.tw': 34,
}

def getStockRealtime(stockIds):
	params = urlencode({
		'ex_ch': '|'.join(list(['tse_{}.tw'.format(stockId) for stockId in stockIds])),
		'json': 1,
		'delay': 0,
	})
	url = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?' + params
	response = requests.get(url)
	ret = {
		'time': datetime.now(),
	}
	if response.status_code != 200:
		print(response.status_code)
	else:
		result = json.loads(response.text)
		for data in result['msgArray']:
			if data['z'] == '-':
				continue
			dateStr = datetime.fromtimestamp(int(data['tlong']) / 1000).strftime('%Y-%m-%d')
			ret['time'] = datetime.strptime(dateStr + ' ' + data['t'], '%Y-%m-%d %H:%M:%S')
			ret[data['c']] = {
				'current': parseFloat(data['z']),
				'low': parseFloat(data['l']),
				'high': parseFloat(data['h']),
				'close': parseFloat(data['y']),
			}
	return ret

def getGroupRealtime():
	params = urlencode({
		'ex_ch': '|'.join(list(titleMap.keys())),
		'json': 1,
		'delay': 0,
	})
	url = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?' + params
	response = requests.get(url)
	data = {}
	if response.status_code != 200:
		print(response.status_code)
	else:
		result = json.loads(response.text)
		for group in result['msgArray']:
			# data['time'] = datetime.fromtimestamp(int(group['tlong']) / 1000)
			k = group['ex']+'_'+group['ch']
			data[k] = {
				'title': titleMap[k]['title'],
				'id': titleMap[k]['id'],
				'time': datetime.strptime('{} {}'.format(group['d'], group['t']), '%Y%m%d %H:%M:%S').timestamp() * 1000,
				'close': parseFloat(group['y'])
			}
			if 'z' in group:
				data[k]['current'] = parseFloat(group['z'])
				data[k]['low'] = parseFloat(group['l'])
				data[k]['high'] = parseFloat(group['h'])
			else:
				data[k]['current'] = None
				data[k]['low'] = None
				data[k]['high'] = None
	return data

def getGroupHistory(d):
	params = urlencode({
		'response': 'csv',
		'date': datetime.strftime(d, '%Y%m%d'),
	})
	url = 'https://www.twse.com.tw/exchangeReport/MI_5MINS_INDEX?' + params
	response = requests.get(url)
	groups = {}
	if response.status_code != 200:
		print(response.status_code)
	else:
		utf8Encoded = response.content.decode(encoding='big5')
		result = csv.reader(StringIO(utf8Encoded), dialect=csv.excel)
		previousTime = d
		for idx, row in enumerate(result):
			if idx <= 1 or len(row) != 36:
				continue
			dateObj = datetime.strftime(d, '%Y-%m-%d ' + row[0].strip('="'))
			epoch = datetime.strptime(dateObj, '%Y-%m-%d %H:%M:%S')
			if previousTime.minute//10 == epoch.minute//10:
				continue
			else:
				previousTime = epoch

			for k, i in historyDataMapping.items():
				groups.setdefault(k, {
					'title': titleMap[k]['title'],
					'id': titleMap[k]['id'],
					'key': k,
					'time': [],
					'value': []
				})
				groups[k]['time'].append(epoch)
				groups[k]['value'].append(parseFloat(row[i]))
	return groups
