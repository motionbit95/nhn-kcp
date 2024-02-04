var express = require("express");
var router = express.Router();
var path = require("path");
var fetch = require("node-fetch");
const crypto = require("crypto");
const fs = require("fs");
require("dotenv").config();
const { decodeURIComponentCharset } = require("decode-uri-component-charset");

// INDEX PAGE
router.get("/", function (req, res) {
  res.render("index", {
    title: "가맹점 본인인증 샘플 페이지",
  });
});

// make_hash PAGE
router.get("/sample/make_hash", function (req, res) {
  res.render("sample/make_hash");
});

// kcp_cert_start PAGE
router.post("/sample/kcp_cert_start", function (req, res) {
  // 본인 확인 요청 데이터
  res.render("sample/kcp_cert_start", {
    Ret_URL: process.env.deploy_url + process.env.g_conf_Ret_URL,
    site_cd: f_get_parm(req.body.site_cd),
    ordr_idxx: f_get_parm(req.body.ordr_idxx),
    up_hash: f_get_parm(req.body.up_hash),
    web_siteid: f_get_parm(req.body.web_siteid),
    kcp_merchant_time: f_get_parm(req.body.kcp_merchant_time),
    kcp_cert_lib_ver: f_get_parm(req.body.kcp_cert_lib_ver),
    web_siteid_hashYN: f_get_parm(req.body.web_siteid_hashYN),
  });
});

// kcp_cert_req PAGE (ret_url)
router.post("/sample/kcp_cert_req", function (req, res) {
  console.log(req.body);
  //post DATA를 가져와 JSON으로 형변환
  var sbParam = req.body;
  res.render("sample/kcp_cert_req", {
    sbParam: JSON.stringify(sbParam),
  });
});

// kcp_cert_res PAGE
router.post("/sample/kcp_cert_res", function (req, res) {
  // console.log(req.body);
  var site_cd = req.body.site_cd;
  var cert_no = req.body.cert_no;
  var dn_hash = req.body.dn_hash;
  var ct_type = "CHK";
  var sbParam = req.body;

  var dnhash_data = site_cd + "^" + ct_type + "^" + cert_no + "^" + dn_hash; //dn_hash 검증 서명 데이터
  var kcp_sign_data = makeSignatureData(dnhash_data); //서명 데이터(무결성 검증)

  var req_data = {
    kcp_cert_info: process.env.g_conf_cert_info,
    site_cd: site_cd,
    ordr_idxx: req.body.ordr_idxx, // dn_hash 검증 요청 전 가맹점 DB상의 주문번호와 동일한지 검증 후 요청 바랍니다.
    cert_no: cert_no,
    dn_hash: dn_hash,
    ct_type: ct_type,
    kcp_sign_data: kcp_sign_data,
  };

  fetch(process.env.g_conf_cert_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req_data),
  })
    // API RES
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      var dn_res_cd = data.res_cd;

      ct_type = "DEC";

      var decrypt_data = site_cd + "^" + ct_type + "^" + cert_no; //데이터 복호화 검증 서명 데이터
      kcp_sign_data = makeSignatureData(decrypt_data); //서명 데이터(무결성 검증)

      req_data = {
        kcp_cert_info: process.env.g_conf_cert_info,
        site_cd: site_cd,
        ordr_idxx: req.body.ordr_idxx,
        cert_no: cert_no,
        ct_type: ct_type,
        enc_cert_Data: req.body.enc_cert_data2,
        kcp_sign_data: kcp_sign_data,
      };

      //dn _hash 검증데이터가 정상일 때, 복호화 요청 함
      if (dn_res_cd === "0000") {
        fetch(process.env.g_conf_cert_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req_data),
        })
          // API RES
          .then((response) => {
            return response.json();
          })
          .then((data) => {
            const enc_res_msg = sbParam.res_msg;
            const dec_res_msg = decodeURIComponentCharset(
              enc_res_msg,
              "euc-kr"
            );

            const enc_user_name = sbParam.user_name;
            const dec_user_name = decodeURIComponentCharset(
              enc_user_name,
              "euc-kr"
            );

            console.log("data>>>>>", data);
            console.log("sbParam >>>>>", sbParam);

            // URL 쿼리 매개변수 생성
            var queryParams = new URLSearchParams();
            queryParams.set("name", data.user_name);
            queryParams.set("phoneNumber", data.phone_no);
            queryParams.set("birthdate", data.birth_day);
            queryParams.set("gender", data.sex_code);

            sbParam.res_msg = dec_res_msg;
            sbParam.user_name = dec_user_name;
            res.render("sample/kcp_cert_res", {
              next_page:
                process.env.app_url +
                process.env.g_conf_next_page +
                "?" +
                queryParams.toString(),
              data: JSON.stringify(data),
              sbParam: JSON.stringify(sbParam),
            });
          });
      } else {
        console.log("dn_hash 변조 위험있음"); //dn_hash 검증에 실패했을 때, console 출력
      }
    });
});

// 본인인증 up_hash 생성 API
router.post("/kcp_api_hash", function (req, res) {
  var site_cd = process.env.g_conf_site_cd;
  var ct_type = f_get_parm(req.body.ct_type);
  var ordr_idxx = f_get_parm(req.body.ordr_idxx);
  var web_siteid = process.env.g_conf_web_siteid;
  var make_req_dt = f_get_parm(req.body.make_req_dt);
  var web_siteid_hashYN = process.env.g_conf_web_siteid_hashYN;

  var hash_data = site_cd + "^" + ct_type + "^" + make_req_dt; //up_hash 생성 서명 데이터
  var kcp_sign_data = makeSignatureData(hash_data); //서명 데이터(무결성 검증)

  // up_hash 생성 REQ DATA
  var req_data = {
    site_cd: site_cd,
    kcp_cert_info: process.env.g_conf_cert_info,
    ct_type: ct_type,
    ordr_idxx: ordr_idxx,
    web_siteid: web_siteid,
    make_req_dt: make_req_dt,
    kcp_sign_data: kcp_sign_data,
  };

  // 본인인증 up_hash 생성 API URL
  fetch(process.env.g_conf_cert_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req_data),
  })
    //본인인증 API RES
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      res.render("kcp_api_hash", {
        data: data,
        site_cd: site_cd,
        ordr_idxx: ordr_idxx,
        web_siteid: web_siteid,
        web_siteid_hashYN: web_siteid_hashYN,
      });
    });
});

// null 값 처리
function f_get_parm(val) {
  if (val == null) val = "";
  return val;
}

// 서명데이터 생성 예제
function makeSignatureData(data) {
  // 개인키 READ
  // "splPrikeyPKCS8.pem" 은 테스트용 개인키
  // "changeit" 은 테스트용 개인키비밀번호

  // const filePath = "../certificate/splPrikeyPKCS8.pem";
  // var password = "changeit";

  const filePath = "../certificate/KCP_AUTH_AJZLF_PRIKEY.pem";
  var password = "wlsghks2@!";

  // 현재 스크립트가 위치한 디렉토리를 기준으로 상대경로를 절대경로로 변환
  const absoluteFilePath = path.resolve(__dirname, filePath);

  var key_file = fs.readFileSync(absoluteFilePath).toString();

  // 서명 생성
  const sign = crypto
    .createSign("sha256")
    .update(data)
    .sign({ format: "pem", key: key_file, passphrase: password }, "base64");

  return sign;
}

// function get_cert_info() {
//   // 개인키 경로
//   const filePath = "../certificate/KCP_AUTH_AJZLF_CERT.pem";
//   // 현재 스크립트가 위치한 디렉토리를 기준으로 상대경로를 절대경로로 변환
//   const absoluteFilePath = path.resolve(__dirname, filePath);

//   const STX = "-----BEGIN CERTIFICATE-----";
//   const ETX = "-----END CERTIFICATE-----";
//   // 개인 키 파일 읽기
//   const cert_info = fs
//     .readFileSync(absoluteFilePath, "utf8")
//     .toString()
//     .replace(STX, "")
//     .replace(ETX, "")
//     .replace(/(\s*)/g, "");

//   return STX + cert_info + ETX;
// }

/* POST /api
 * IOS, AOS앱 및 인앱브라우저에서는 결제창 호출 방식을 다이렉트로 연결해야 합니다.
 * 다이렉트 호출 방식은 결제 페이지로 이동 후, 결제가 완료되면 POST를 통해 결제 결과 파라미터를 보내줍니다.
 * ref: https://developer.payple.kr/service/faq
 */
router.post("/pg", (req, res) => {
  const data = {
    PCD_PAY_RST: req.body.PCD_PAY_RST, // 결제요청 결과(success|error)
    PCD_PAY_MSG: req.body.PCD_PAY_MSG, // 결제요청 결과 메시지
    PCD_PAY_OID: req.body.PCD_PAY_OID, // 주문번호
    PCD_PAY_TYPE: req.body.PCD_PAY_TYPE, // 결제 방법 (transfer | card)
    PCD_PAY_WORK: req.body.PCD_PAY_WORK, // 결제요청 업무구분 (AUTH : 본인인증+계좌등록, CERT: 본인인증+계좌등록+결제요청등록(최종 결제승인요청 필요), PAY: 본인인증+계좌등록+결제완료)
    PCD_PAYER_ID: req.body.PCD_PAYER_ID, // 카드등록 후 리턴받은 빌링키
    PCD_PAYER_NO: req.body.PCD_PAYER_NO, // 가맹점 회원 고유번호
    PCD_PAYER_NAME: req.body.PCD_PAYER_NAME, // 결제자 이름
    PCD_PAYER_EMAIL: req.body.PCD_PAYER_EMAIL, // 결제자 Email
    PCD_REGULER_FLAG: req.body.PCD_REGULER_FLAG, // 정기결제 여부 (Y | N)
    PCD_PAY_YEAR: req.body.PCD_PAY_YEAR, // 결제 구분 년도 (PCD_REGULER_FLAG 사용시 응답)
    PCD_PAY_MONTH: req.body.PCD_PAY_MONTH, // 결제 구분 월 (PCD_REGULER_FLAG 사용시 응답)
    PCD_PAY_GOODS: req.body.PCD_PAY_GOODS, // 결제 상품
    PCD_PAY_TOTAL: req.body.PCD_PAY_TOTAL, // 결제 금액
    PCD_PAY_TAXTOTAL: req.body.PCD_PAY_TAXTOTAL, // 복합과세(과세+면세) 주문건에 필요한 금액이며 가맹점에서 전송한 값을 부가세로 설정합니다. 과세 또는 비과세의 경우 사용하지 않습니다.
    PCD_PAY_ISTAX: req.body.PCD_PAY_ISTAX, // 과세설정 (Default: Y, 과세:Y, 복합과세:Y, 비과세: N)
    PCD_PAY_CARDNAME: req.body.PCD_PAY_CARDNAME, // [카드결제] 카드사명
    PCD_PAY_CARDNUM: req.body.PCD_PAY_CARDNUM, // [카드결제] 카드번호 (ex: 1234-****-****-5678)
    PCD_PAY_CARDTRADENUM: req.body.PCD_PAY_CARDTRADENUM, // [카드결제] 카드결제 거래번호
    PCD_PAY_CARDAUTHNO: req.body.PCD_PAY_CARDAUTHNO, // [카드결제] 카드결제 승인번호
    PCD_PAY_CARDRECEIPT: req.body.PCD_PAY_CARDRECEIPT, // [카드결제] 카드전표 URL
    PCD_PAY_TIME: req.body.PCD_PAY_TIME, // 결제 시간 (format: yyyyMMddHHmmss, ex: 20210610142219)
    PCD_TAXSAVE_RST: req.body.PCD_TAXSAVE_RST, // 현금영수증 발행결과 (Y | N)
    PCD_AUTH_KEY: req.body.PCD_AUTH_KEY, // 결제용 인증키
    PCD_PAY_REQKEY: req.body.PCD_PAY_REQKEY, // 결제요청 고유 KEY
    PCD_PAY_COFURL: req.body.PCD_PAY_COFURL, // 결제승인요청 URL
  };

  // React로 값 전송 (url parameters)
  res.redirect(
    process.env.REACT_APP_HOSTNAME +
      "/order_result?" +
      encodeURIComponent(JSON.stringify(data))
  );
});

/* POST /api/auth
   파트너 인증
 */
router.post("/pg/auth", async (req, res, next) => {
  try {
    const caseParams = req.body; // 상황별 파트너 인증 파라미터
    const params = {
      cst_id: process.env.REACT_APP_CST_ID, // 파트너 ID (실결제시 발급받은 운영ID를 작성하시기 바랍니다.)
      custKey: process.env.REACT_APP_CUST_KEY, // 파트너 인증키 (실결제시 발급받은 운영Key를 작성하시기 바랍니다.)
      ...caseParams,
    };

    /*  ※ Referer 설정 방법
            TEST : referer에는 테스트 결제창을 띄우는 도메인을 넣어주셔야합니다. 결제창을 띄울 도메인과 referer값이 다르면 [AUTH0007] 응답이 발생합니다.
            REAL : referer에는 가맹점 도메인으로 등록된 도메인을 넣어주셔야합니다.
            다른 도메인을 넣으시면 [AUTH0004] 응답이 발생합니다.
            또한, TEST에서와 마찬가지로 결제창을 띄우는 도메인과 같아야 합니다.
        */
    const { data } = await axios.post(process.env.REACT_APP_AUTH_URL, params, {
      headers: {
        "content-type": "application/json",
        referer: process.env.REACT_APP_HOSTNAME,
      },
    });

    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

module.exports = router;
