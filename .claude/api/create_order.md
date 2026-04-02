# API：create order

# cURL request

```bash
curl -H "Host: sportmeta.hdu.edu.cn" -H "Accept: */*" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuaWQiOiIyNDA1MDUxMSIsImV4cCI6MTc3NDk3NTczOH0.8nkuhdHOWVIOU02HKBwq_F55Fg_zzUmm6Wy2Kw1p5BY" -H "Sec-Fetch-Site: same-origin" -H "Accept-Language: zh-CN,zh-Hans;q=0.9" -H "Sec-Fetch-Mode: cors" -H "Content-Type: application/json" -H "Origin: https://sportmeta.hdu.edu.cn" -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23E246 AliApp(DingTalk/7.8.1) com.laiwang.DingTalk/46766536 Channel/201200 language/zh-Hans-CN UT4Aplus/0.0.6 WK" -H "Referer: https://sportmeta.hdu.edu.cn/book/dingtalk/" -H "DingTalk-Flag: 1" -H "Sec-Fetch-Dest: empty" --data-binary "{\"orderData\":{\"openid\":\"24050511\",\"nickname\":\"刘振科\",\"phone\":\"15934125523\",\"date\":\"2026-4-2\",\"venue_name\":\"综合馆羽毛球\",\"venue_type\":\"badminton\",\"site_id\":1,\"total_price\":0,\"time_list\":[4],\"start_time\":\"11:40\",\"end_time\":\"13:20\"}}" --compressed "https://sportmeta.hdu.edu.cn/book/client/creat_order"
```

# response

```json
{
  "data": {
    "venue_name": "\u7efc\u5408\u9986\u7fbd\u6bdb\u7403",
    "openid": "24050511",
    "venue_type": "badminton",
    "order_num": "17749584052849",
    "total_price": "0.00",
    "order_date": "2026-04-02",
    "site_id": 1,
    "creat_time": "2026-03-31 20:00",
    "start_time": "11:40",
    "end_time": "13:20"
  },
  "status": "success",
  "message": "\u9884\u7ea6\u6210\u529f"
}
```
