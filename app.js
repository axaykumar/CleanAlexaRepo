/* GLOBAL / PROCESS VARIABLES */
var port = process.env.PORT || 8080;
var clientId = '';
var clientSecret = '';
var redirectURI = '';
var API = process.env.API || 'v32.0';
var oauth_timeout = process.env.oauth_timeout || 480000;
var DEBUG_ON = process.env.DEBUG_ON || true;

/* REQUIRED PACKAGES */

//alexa response transform
var alexa = require('alexa-nodekit');

//express for routing
var express = require('express');
var app = express();
var bodyParser = require("body-parser");
app.use(bodyParser());

//convert OAuth requests to/from Salesforce to Amazon
var sfdc_amazon = require('sfdc-oauth-amazon-express');

//Salesforce REST wrapper
var nforce = require('nforce');

//Connected App credentials for OAUTH request
var org = nforce.createConnection({
  clientId: clientId,
  clientSecret: clientSecret,
  redirectUri: redirectURI,
  apiVersion: API, 
  mode: 'single',
  plugins: []
});

/* SETUP ROUTES */

app.get('/', function (req, res) {
  res.jsonp({status: 'Apttus Alexa is ready and up'});
});

app.post('/echo', function (req, res) {
  if(req.body == null) {
    console.log("WARN: No Post Body Detected");
  }
  
  if(req.body.request.intent == null) {
    route_alexa_begin(req,res);
  } else {
    route_alexa_intent(req,res);
  }
});

sfdc_amazon.addRoutes(app,oauth_timeout,true);

//setup actual server
var server = app.listen(port, function () {
  console.log('Salesforce Case Echo running on '+port);
  require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    console.log('addr: '+add);
  });
});



/* List of identifiable intent / actions that the route will respond to */
var intent_functions = new Array();
intent_functions['PleaseWait'] = PleaseWait;
intent_functions['CreateFavoriteQuote'] = CreateFavoriteQuotes;
intent_functions['GetOpportunityWonToday'] = GetOpportunityWonToday;

function CreateFavoriteQuotes(req, res, intent) {	
	console.log("intent " + intent.slots);
	console.log("intent " + intent.slots.account);
	var post = intent.slots.account.value;
	console.log("Account Name>>>>"+post);
	
	org.apexRest({oauth:intent.oauth, uri:'EchoFavoriteQuote',method:'POST', body:'{"accountName":"'+post+'"}'},
	function(err,result) {
		if(err) {
		  console.log(err);
		  send_alexa_error(res,'An error occured while creating favorite quote: '+err);
		}else{	
		  console.log(result);
		  let message = 'Created Favorite Quote for '+ post;
		  if(result && result > 0){
			//message = message + 'Quote created for ' + result.Name;
		  }
		  send_alexa_response(res, message, 'APTTUS', 'Create Favorite Quote', 'Quote for '+ post, false);
		}
	});
}





function PleaseWait(req,res,intent) {
  send_alexa_response(res, 'Waiting', 'Salesforce', '...', 'Waiting', false);
}

function GetOpportunityWonToday(req,res,intent) {
  
	org.apexRest({oauth:intent.oauth, uri:'OpportunityControlREST',method:'GET'}, 
	function(err,result) {
		if(err) {
		  console.log(err);
		  send_alexa_error(res,'An error occured getting the total amount of opportunities closed today: '+err);
		}else{	
		  console.log(result);	
		  send_alexa_response(res, 'We closed dollar '+ result +' worth of opportunities today.', 'Opportunity Details', 'Total Closed-Won Opportunities', 'We closed $'+ result +' worth of opportunities today.', false);
		}
	});
}


/* UTILIY FUNCTIONS */
function send_alexa_error(res,message) {
	send_alexa_response(res, 'An error occured during that request.  Please check the application log.', 'APTTUS', 'Error', message, true);
}

function send_alexa_response(res, speech, title, subtitle, content, endSession) {
    alexa.response(speech, 
           {
            title: title,
            subtitle: subtitle,
            content: content
           }, endSession, function (error, response) {
           if(error) {
             console.log({message: error});
             return res.status(400).jsonp({message: error});
           }
           return res.jsonp(response);
         });
}


function route_alexa_begin(req, res) {
   
//   alexa.launchRequest(req.body);
   if(req.body.session == null || req.body.session.user == null || req.body.session.user.accessToken == null) {
        send_alexa_response(res, 'Please log into Salesforce', 'Salesforce', 'Not Logged In', 'Error: Not Logged In', true);
   } else {
   		send_alexa_response(res, 'Connected to Salesforce',  'Connectedt to Salesforce', 'Connection Attempt', 'Logged In (Single User)', false);
   }
   
   console.log('!----REQUEST SESSION--------!');
   console.log(req.body.session);

   

};


function route_alexa_intent(req, res) {

   if(req.body.session == null || req.body.session.user == null || req.body.session.user.accessToken == null) {
        send_alexa_response(res, 'Please log into Salesforce', 'Salesforce', 'Not Logged In', 'Error: Not Logged In', true);
	  
   } else {
   	   intent = new alexa.intentRequest(req.body);
	   intent.oauth = sfdc_amazon.splitToken(req.body.session.user.accessToken);
	   console.log("INTENT>>>"+intent.intentName);
	   console.log("USERID>>>>"+req.body.session.user.userId);

	  if(intent_functions[intent.intentName]){
		intent_function = intent_functions[intent.intentName];
		intent_function(req,res,intent);	
	   }else{
		console.log("Intent not found" + intent.intentName);
		send_alexa_error(res, "Intent not found" + intent.intentName)
	   }	
   }

};
