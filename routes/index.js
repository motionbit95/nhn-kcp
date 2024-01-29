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
  //post DATA를 가져와 JSON으로 형변환
  var sbParam = req.body;
  res.render("sample/kcp_cert_req", {
    sbParam: JSON.stringify(sbParam),
  });
});

// kcp_cert_res PAGE
router.post("/sample/kcp_cert_res", function (req, res) {
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

      console.log(req_data);

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

            sbParam.res_msg = dec_res_msg;
            sbParam.user_name = dec_user_name;
            res.render("sample/kcp_cert_res", {
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

  // 개인키 경로
  const filePath = "../certificate/KCP_AUTH_AJZLF_PRIKEY.pem";
  // 현재 스크립트가 위치한 디렉토리를 기준으로 상대경로를 절대경로로 변환
  const absoluteFilePath = path.resolve(__dirname, filePath);

  var key_file = fs.readFileSync(absoluteFilePath).toString();
  var password = "wlsghks2@!";

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

module.exports = router;
