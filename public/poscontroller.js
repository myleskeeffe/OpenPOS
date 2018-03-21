// Copyright (c) 2017 David Kim
// This program is licensed under the "MIT License".
// Please see the file COPYING in the source
// distribution of this software for license terms.

var app = angular.module('OpenPOS', ['ui.bootstrap']);

// change Angular's {{foo}} -> {[{bar}]} to avoid clashing with Handlebars syntax
app.config(function ($interpolateProvider) {
	$interpolateProvider.startSymbol('[[');
	$interpolateProvider.endSymbol(']]');
});

// main controller
app.controller('PosController', function ($scope, $http) {
	//	console.log("Hello world from PosController/poscontroller.js");

	$scope.basic = [];
	$scope.premium = [];
	$scope.other = [];

	$scope.categories = [
		{
			'category': 'Basic'
		},
		{
			'category': 'Premium'
		},
		{
			'category': 'Other'
		}
    ]

	$scope.selectedCategory = '';
	$scope.order = [];
	$scope.new = {};
	$scope.totOrders = 0;

	const setTotalOrders = function() {
		$http.get('/getTotalOrdersForToday').success(function (response) {
			$scope.totOrders = response.count;
		}).error(function(err) {
			console.error('error -> ' + err);
		});
	}

	setTotalOrders();

	$scope.addToOrder = function (item, qty) {
		var flag = 0;
		if ($scope.order.length > 0) {
			for (var i = 0; i < $scope.order.length; i++) {
				if (item.id === $scope.order[i].id) {
					item.qty += qty;
					flag = 1;
					break;
				}
			}
			if (flag === 0) {
				item.qty = 1;
			}
			if (item.qty < 2) {
				$scope.order.push(item);
			}
		} else {
			item.qty = qty;
			$scope.order.push(item);
		}
	};

	$scope.removeOneEntity = function (item) {
		for (var i = 0; i < $scope.order.length; i++) {
			if (item.id === $scope.order[i].id) {
				item.qty -= 1;
				if (item.qty === 0) {
					$scope.order.splice(i, 1);
				}
			}
		}
	};

	$scope.removeItem = function (item) {
		for (var i = 0; i < $scope.order.length; i++) {
			if (item.id === $scope.order[i].id) {
				$scope.order.splice(i, 1);
			}
		}
	};

	$scope.getTotal = function () {
		var tot = 0;
		for (var i = 0; i < $scope.order.length; i++) {
			tot += ($scope.order[i].price * $scope.order[i].qty)
		}
		return tot;
	};

	$scope.clearOrder = function () {
		$scope.order = [];
	};

	$scope.getDate = function () {
		var today = new Date();
		var mm = today.getMonth() + 1;
		var dd = today.getDate();
		var yyyy = today.getFullYear();

		var date = dd + "/" + mm + "/" + yyyy

		return date;
	};

	$scope.checkout = function (index) {
		let phoneNumber = $scope.checkout.phoneNumber;
		let buyerName = $scope.checkout.buyername;
		
		let total = $scope.getTotal().toFixed(2);
		let message = $scope.getDate() + " - Order Number: " + ($scope.totOrders + 1) + "\n\nOrder amount: " + total + " rps\n\nPayment received. Thanks.";
		
		$http.post('/checkoutOrder', {
			"name": buyerName,
			"phoneNumber": phoneNumber,
			"servedBy": $scope.uname,
			"message": message,
			"order": $scope.order,
			"total": total
		}).success(function (response) {
			alert(message);
			$scope.order = [];
			$scope.totOrders += 1;
		}).error(function(error) {
			alert(error);
		});
	};

	var refresh = function () {
		$http.get('/productlist').success(function (response) {
			setTotalOrders();
			$scope.productlist = response;
			$scope.product = "";
			//			console.log("RESPONSE: " + response);

			angular.forEach(response, function (item, key) {
				//				console.log("pushing --> " + item.name);
				if (item.category === "Premium") {
					$scope.premium.push({
						id: item._id,
						name: item.name,
						price: item.price
					});
				} else if (item.category === "Basic") {
					$scope.basic.push({
						id: item._id,
						name: item.name,
						price: item.price
					});
				} else {
					$scope.other.push({
						id: item._id,
						name: item.name,
						price: item.price
					});
				}
			});
		});
	};
});


function AppCtrl($scope, $http) {
	//	console.log("Hello world from AppCtrl/poscontroller.js");

	var refresh = function () {
		$http.get('/productlist').success(function (response) {
			$scope.premium.length = 0; // clear all the buttons from the Menu Panel
			$scope.basic.length = 0; // clear all the buttons from the Menu Panel
			$scope.other.length = 0; // clear all the buttons from the Menu Panel

			$scope.productlist = response;
			$scope.product = "";
			//			console.log("RESPONSE: " + response);

			angular.forEach(response, function (item, key) {
				//				console.log("adding menu item --> " + item.name);

				if (item.category === "Premium") {
					$scope.premium.push({
						id: item._id,
						name: item.name,
						price: item.price
					});
				} else if (item.category === "Basic") {
					$scope.basic.push({
						id: item._id,
						name: item.name,
						price: item.price
					});
				} else {
					$scope.other.push({
						id: item._id,
						name: item.name,
						price: item.price
					});
				}
			});
		});
	};

	refresh();

	$scope.addProduct = function () {
		var nameStr = $scope.product.name;
		var priceStr = $scope.product.price;
		var priceRegex = /^((\d{0,3}(,\d{3})+)|\d+)(\.\d{2})?$/; // valid currency values only

		if ($scope.accessLevel !== ('admin')) {
			alert("You do not have access to make changes.");
		}
		else if (!nameStr) {
			alert("Pleae provide the name of the Item");
		}
		else if (nameStr.length > 36) {
			alert("Item name can be a maximum of 36 characters long.");
		} else if (!priceRegex.test(priceStr)) {
			alert("Please enter a valid price.");
		} else {
			//			alert("Adding item: " + nameStr);
			$scope.product.category = $scope.selectedCategory;
			$scope.product.user = $scope.uname;
			console.log($scope.product);
			$http.post('/productlist', $scope.product).success(function (response) {
				//			console.log("addProduct: " + $scope.product);
				refresh(); // refresh the Menu Panel
			});
		}
	};

	$scope.remove = function (id) {
		if ($scope.accessLevel !== ('admin')) {
			alert("You do not have access to make changes.");
		} else {
			console.log(id);
			$http.delete('/productlist/' + id).success(function (response) {
				//			console.log("remove: " + response);
				refresh(); // refresh the Menu Panel
			});
	}

	};
}

function TimeCtrl($scope, $timeout) {
	$scope.clock = "loading clock..."; // initialize the time variable
	$scope.tickInterval = 1000 //ms

	var tick = function () {
		$scope.clock = Date.now() // get the current time
		$timeout(tick, $scope.tickInterval); // reset the timer
	}

	// start the timer
	$timeout(tick, $scope.tickInterval);
}

function OrderViewCtrl($scope, $http, $timeout) {
	$scope.orderDate = new Date();
	$scope.ordersForSelectedDate = [];
	$scope.totOrdersForDate = 0;
	$scope.totSaleForDate = 0;
	$scope.showDetailedOrder = false;
		
	$scope.dateOptions = {
		'year-format': "'yy'",
		'starting-day': 1
 	};

	$scope.open = function() {
    	$timeout(function() {
     		$scope.opened = true;
    	});
  	};

	var totalSale = function() {
		let orders = $scope.ordersForSelectedDate;
		if (orders.length > 0) {
			$scope.totSaleForDate = 0;
			orders.forEach(order => {
				$scope.totSaleForDate += parseInt(order.total);
			})
		} else {
			$scope.totSaleForDate = 0;
		}
	}

	$scope.updateOrderView = function() {
		if (typeof $scope.orderDate !== 'undefined') {
			$scope.displayOrderDate = $scope.orderDate.toDateString();

			$http.post('/getOrdersForDate', {orderDate: $scope.orderDate})
			.success(function(response) {
				console.log(response);
				$scope.ordersForSelectedDate = response;
				$scope.totOrdersForDate = $scope.ordersForSelectedDate.length;
				totalSale();
			}).error(function(err) {
				console.log(JSON.stringify(err));
			})
		}
	};

	$scope.showDetail= function(order) {
		console.log('this is getting called with -> ' + JSON.stringify(order));
		$scope.viewSingleOrder = order;
		$scope.showDetailedOrder = true;
	};

	$scope.updateOrderView();

}
