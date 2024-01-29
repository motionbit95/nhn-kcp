var express = require("express");
var app = express();
var path = require("path");
var bodyParser = require("body-parser");
var cors = require("cors");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  cors({
    origin: ["https://dinnermate.kr", "http://localhost:3000"],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

var indexRouter = require("./routes/index");
app.use("/", indexRouter);

app.use("/public", express.static(__dirname + "/public"));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`start! express server on http://localhost:${PORT}`);
});
