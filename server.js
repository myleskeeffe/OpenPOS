// Copyright (c) 2017 David Kim
// This program is licensed under the "MIT License".
// Please see the file COPYING in the source
// distribution of this software for license terms.

var express = require('express'),
	app = express(),
	path = require('path'),
	cookieParser = require('cookie-parser'),
	bodyParser = require('body-parser'),
	exphbs = require('express-handlebars'),
	expressValidator = require('express-validator'),
	flash = require('connect-flash'),
	session = require('express-session'),
	passport = require('passport'),
	LocalStrategy = require('passport-local').Strategy,
	routes = require('./routes/index'),
	users = require('./routes/users'),
	mongo = require('mongodb'),
	mongoose = require('mongoose'),
	db = mongoose.connection,
	request = require('request'),
	moment = require('moment'),
	promise = require('promise'),
	User = require('./models/user');;

// sendPK config
var config = require('./config.json');

// init express
var app = express();

// connect to a local database
//mongoose.connect('mongodb://localhost/loginapp');

// or, connect to MongoDB's Atlas (a cloud-hosted MongoDB service)
var uri = "mongodb://localhost:27017/pos";
mongoose.connect(uri, {
	useMongoClient: true
});
var db1 = mongoose.connection;
db1.on('error', console.error.bind(console, 'connection error:'));
db1.once('open', function () {
	console.log("Connected to MongoDB Atlas");
});

// define a mongoose schema
var productSchema = mongoose.Schema({
	name: String,
	price: String,
	category: String
});

// define a mongoose model
var Products = mongoose.model('products', productSchema, 'products');

// setup view engine
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', exphbs({
	defaultLayout: 'layout'
}));
app.set('view engine', 'handlebars');

// setup bodyParser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	//	extended: false
	extended: true
}));
app.use(cookieParser());

// setup an express session
app.use(session({
	secret: 'secret',
	saveUninitialized: true,
	resave: true
}));

// init passport
app.use(passport.initialize());
app.use(passport.session());

// setup express validator
app.use(expressValidator({
	errorFormatter: function (param, msg, value) {
		var namespace = param.split('.'),
			root = namespace.shift(),
			formParam = root;

		while (namespace.length) {
			formParam += '[' + namespace.shift() + ']';
		}
		return {
			param: formParam,
			msg: msg,
			value: value
		};
	},
	customValidators: {
		isUsernameAvailable: function(username) {
				return new Promise(function(resolve, reject) {

					User.findOne({'username': username}, function(err, results) { 
						if(results === null) {
							return resolve();
						}
						reject(results);
					});

				});
			}
		}
}));

// connect flash
app.use(flash());

// global vars
app.use(function (req, res, next) {
	res.locals.success_msg = req.flash('success_msg');
	res.locals.error_msg = req.flash('error_msg');
	res.locals.error = req.flash('error');
	res.locals.user = req.user || null;
	next();
});

// -------------------- END - Express routing for product CRUD operations --------------------

// username variable
var uname = "";

function isEmpty(str) {
	return (!str || 0 === str.length);
}

// find products from db
app.get('/productlist', function (req, res) {

	// make sure uname is set to the login username
	if (typeof req["user"].username === 'undefined') {
		uname = req["user"].user;
	}

	if (isEmpty(uname)) {
		uname = req["user"].username;
	} else if (!isEmpty(req['user'].username) && (uname !== req['user'].username)) {
		uname = req['user'].username;
	}

	// find all products (documents) belonging to the user
	console.log(uname, "just logged into OpenPOS");
	Products.find({
	}, function (err, docs) {
		console.log("Finding all docs for", uname + ":\n", docs);
		res.json(docs);
	});
});

// add product from db
app.post('/productlist', function (req, res) {
	console.log("Item requested to be added to the db: ", req.body);

	// create a new product using the data sent from the client
	var p = new Products(req.body);

	// save the new product to the db
	p.save(function (err, doc) {
		if (err) {
			return console.error(err)
		} else {
			console.log("Saving p to db: ", doc);
			res.json(doc);
		}
	});
});

// delete product from db
app.delete('/productlist/:id', function (req, res) {

	// get the product id
	var id = req.params.id;
	console.log("Removing item - id: " + id);

	// remove the product from the db
	Products.remove({
		_id: id
	}, function (err, doc) {
		res.json(doc);
	});
});

// ---------------------- CHECKOUT ORDERS

// define a mongoose schema
var checkoutSchema = mongoose.Schema({
	name: String,
	phoneNumber: String,
	servedBy: String,
	createdAt: Date,
	order: [],
	total: String
});

// define a mongoose model
var Checkout = mongoose.model('checkout', checkoutSchema, 'checkout');

const saveOrderToDB = async (data) => {
	console.warn('request to save order in db');
	console.log(JSON.stringify(data, null, '   '));

	return new promise(function(resolve, reject) {
		data.createdAt = moment();

		// create a new checout using the data sent from the client
		var c = new Checkout(data);
		console.log('checkout item ' + JSON.stringify(c, null, '  '));

		// save the new product to the db
		c.save(function (err, doc) {
			if (err) {
				reject(err);
			} else {
				console.log("Saving c to db: ", doc);
				resolve(doc);
			}
		});
	});
};

app.post('/checkoutOrder', async(req, res) => {
	console.log('checking out order');

	console.log(JSON.stringify(req.body, null, '   '));

	let body = req.body;

	//save here
	let savedOrder = await saveOrderToDB(body);

	let message = "Thank you for visiting Shahzad's Hair Saloon. \n\nOrder id: " + savedOrder._id + "\nAmount paid: " + body.total;

	if (typeof body.phoneNumber !== 'undefined' && body.phoneNumber.trim() !== "") {
		// has phone number in body, will try to send message

		postData = {
			username: config.username,
			password: config.password,
			mobile: body.phoneNumber,
			sender: "HairSaloon",
			message: message
		};

		let options = {
			method: "POST",
			uri: "http://sendpk.com/api/sms.php?"+require('querystring').stringify(postData)
		}

		request.post(options, function(error, response, body){
			console.log(JSON.stringify(error, null, '   '));
			console.log(JSON.stringify(body, null, '   '));
			
			if (body.includes('OK')) {
				//successfully sent
				console.warn('body -> '+body);
				res.status(200).send('sms sent');	
			} else {
				//error in sending message
				console.error('error -> '+body);
				res.status(400).send(body);
			}
		});

	} else {
		// no need to send message
		res.status(200).send(body.message);
	}
});

app.get('/totalOrders', function(req, res) {
	Checkout.count({
	}, function (err, count) {
		res.json({count: count});
	});
});

app.get('/getTotalOrdersForToday', function(req, res) {
	var today = moment().startOf('day')
	var tomorrow = moment(today).add(1, 'days')

	Checkout.count({
		createdAt: {
			$gte: today.toDate(),
			$lt: tomorrow.toDate()
		}
	}, function(err, count) {
		res.json({count: count});
	});
});

app.post('/getOrdersForDate', function(req, res) {

	let date = req.body.orderDate;
	console.log('date received is -> ' + date);
	var today = moment(date).startOf('day')
	var tomorrow = moment(today).add(1, 'days')

	Checkout.find({
		createdAt: {
			$gte: today.toDate(),
			$lt: tomorrow.toDate()
		}
	}, function(err, docs) {
		res.json(docs);
	});
});

// -------------------- START - Express routing for product CRUD operations --------------------

// setup static routes
app.use(express.static(__dirname + '/public'));

// setup routes
app.use('/', routes);
app.use('/users', users);

// set the port
app.set('port', (process.env.PORT || 3000));

// start the server
app.listen(app.get('port'), function () {
	console.log('Server running on port ' + app.get('port'));
});