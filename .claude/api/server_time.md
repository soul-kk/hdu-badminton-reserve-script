# API：请求服务器端端时间戳

# cURL request

```bash
curl -H "Host: sportmeta.hdu.edu.cn" -H "Accept: */*" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuaWQiOiIyNDA1MDUxMSIsImV4cCI6MTc3NDkzODUyMn0.fG7ZavoYaoiG0qyL0OMtKTy1mSt_Xo92NBcOtDg7WDo" -H "Sec-Fetch-Site: same-origin" -H "Accept-Language: zh-CN,zh-Hans;q=0.9" -H "Sec-Fetch-Mode: cors" -H "Content-Type: application/json" -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23E246 AliApp(DingTalk/7.8.1) com.laiwang.DingTalk/46766536 Channel/201200 language/zh-Hans-CN UT4Aplus/0.0.6 WK" -H "Referer: https://sportmeta.hdu.edu.cn/book/dingtalk/" -H "DingTalk-Flag: 1" -H "Sec-Fetch-Dest: empty" --compressed "https://sportmeta.hdu.edu.cn/book/client/post_server_time"
```

# response

```json
{ "data": 1774920916000 }
```
