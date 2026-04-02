# API：请求场地信息列表

# cURL request

```bash
curl -H "Host: sportmeta.hdu.edu.cn" -H "Accept: */*" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuaWQiOiIyNDA1MDUxMSIsImV4cCI6MTc3NDkzODUyMn0.fG7ZavoYaoiG0qyL0OMtKTy1mSt_Xo92NBcOtDg7WDo" -H "Sec-Fetch-Site: same-origin" -H "Accept-Language: zh-CN,zh-Hans;q=0.9" -H "Sec-Fetch-Mode: cors" -H "Content-Type: application/json" -H "Origin: https://sportmeta.hdu.edu.cn" -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23E246 AliApp(DingTalk/7.8.1) com.laiwang.DingTalk/46766536 Channel/201200 language/zh-Hans-CN UT4Aplus/0.0.6 WK" -H "Referer: https://sportmeta.hdu.edu.cn/book/dingtalk/" -H "DingTalk-Flag: 1" -H "Sec-Fetch-Dest: empty" --data-binary "{\"date\":\"2026-4-1\",\"venue_name\":\"综合馆羽毛球\",\"is_permanent\":0}" --compressed "https://sportmeta.hdu.edu.cn/book/client/post_site_situation"
```

# response

```json
{
  "site_situation": [
    {
      "site_id": 1,
      "book_time_list": [4, 5, 6, 7, 8, 10, 11, 12],
      "oci_time_list": [10, 11, 12]
    },
    {
      "site_id": 2,
      "book_time_list": [4, 5, 6, 7, 8, 10, 11, 12],
      "oci_time_list": [10, 11, 12]
    },
    {
      "site_id": 3,
      "book_time_list": [4, 5, 6, 7, 8, 10, 11, 12],
      "oci_time_list": [10, 11, 12]
    },
    {
      "site_id": 4,
      "book_time_list": [4, 5, 6, 7, 8, 10, 11, 12],
      "oci_time_list": [10, 11, 12]
    },
    {
      "site_id": 5,
      "book_time_list": [4, 5, 10, 11, 12],
      "oci_time_list": [6, 7, 8, 10, 11, 12]
    },
    {
      "site_id": 6,
      "book_time_list": [4, 5, 6, 7, 8, 10, 11, 12],
      "oci_time_list": [10, 11, 12]
    },
    { "site_id": 7, "book_time_list": [5, 6, 7, 8], "oci_time_list": [4] },
    { "site_id": 8, "book_time_list": [5, 6, 7, 8], "oci_time_list": [4] },
    { "site_id": 9, "book_time_list": [5, 6, 7, 8], "oci_time_list": [4] },
    { "site_id": 10, "book_time_list": [5, 6, 7, 8], "oci_time_list": [4] },
    { "site_id": 11, "book_time_list": [5, 6, 7, 8], "oci_time_list": [4] },
    { "site_id": 12, "book_time_list": [5, 6, 7, 8], "oci_time_list": [4] }
  ],
  "extra_list": { "extra_price_time": [], "extra_price_list": [] }
}
```
