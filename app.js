var express = require("express");
var app = express();
var path = require("path");
var bodyParser = require("body-parser");
var cors = require("cors");
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8000;
const dev = false;
const url = dev
  ? `http://localhost:${PORT}`
  : "https://dinnermate-node-server-0d7d5dc74685.herokuapp.com";
app.use(
  cors({
    origin: [
      `http://localhost:${PORT}`,
      "https://dinnermate-node-server-0d7d5dc74685.herokuapp.com/",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

var indexRouter = require("./routes/index");
app.use("/", indexRouter);

app.use("/public", express.static(__dirname + "/public"));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.listen(PORT, () => {
  console.log(`start! express server on ${url}`);
});
