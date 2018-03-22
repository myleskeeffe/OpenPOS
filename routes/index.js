// Copyright (c) 2017 David Kim
// This program is licensed under the "MIT License".
// Please see the file COPYING in the source
// distribution of this software for license terms.

var express = require('express');
var app = express();
var router = express.Router();

// get homepage
router.get('/', ensureAuthenticated, function (req, res) {
	res.render('index', {
		username: req.user.username,
		access: req.user.access || 'general'
	});
});

// view orders
router.get('/viewOrders', ensureAdmin, function (req, res) {
	res.render('orders', {
		username: req.user.username,
		access: req.user.access || 'general'
	});
});

// view users
router.get('/viewUsers', ensureAdmin, function (req, res) {
	res.render('users', {
		username: req.user.username,
		access: req.user.access || 'general'
	});
});

function ensureAdmin(req, res, next) {
	if (req.isAuthenticated()) {
		if (req.user.access === 'admin')
			return next();
		else {
			req.flash('error_msg', 'You have to be an admin to view this page');
			res.redirect('/users/login');	
		}
	} else {
		res.redirect('/users/login');
	}
}

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	} else {
		res.redirect('/users/login');
	}
}

module.exports = router;
