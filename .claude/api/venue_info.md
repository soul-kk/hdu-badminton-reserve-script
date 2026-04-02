# API：请求羽毛球场馆信息

# cURL request

```bash
curl -H "Host: sportmeta.hdu.edu.cn" -H "Accept: */*" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuaWQiOiIyNDA1MDUxMSIsImV4cCI6MTc3NDkzODUyMn0.fG7ZavoYaoiG0qyL0OMtKTy1mSt_Xo92NBcOtDg7WDo" -H "Sec-Fetch-Site: same-origin" -H "Accept-Language: zh-CN,zh-Hans;q=0.9" -H "Sec-Fetch-Mode: cors" -H "Content-Type: application/json" -H "Origin: https://sportmeta.hdu.edu.cn" -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23E246 AliApp(DingTalk/7.8.1) com.laiwang.DingTalk/46766536 Channel/201200 language/zh-Hans-CN UT4Aplus/0.0.6 WK" -H "Referer: https://sportmeta.hdu.edu.cn/book/dingtalk/" -H "DingTalk-Flag: 1" -H "Sec-Fetch-Dest: empty" --data-binary "{\"date\":\"2026-4-1\",\"venue_name\":\"综合馆羽毛球\"}" --compressed "https://sportmeta.hdu.edu.cn/book/client/post_venue_info"
```

# response

```json
{
  "time_list": [
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "11:40",
    "13:20",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00"
  ],
  "days_can_appoint": 2,
  "base_price": 0.0,
  "rest_list": [0, 1, 2, 3, 9, 10, 11, 12]
}
```
