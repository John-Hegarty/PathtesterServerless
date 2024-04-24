import { app } from "@azure/functions";
import * as http from 'http';
import * as https from 'https';
import * as url from 'node:url';
import { performance } from 'perf_hooks'; 
import cronParser from 'cron-parser';
import * as mysql from 'mysql'





function testWebSite(URL , record_id, resultsDB)
{
    console.log("Starting " + URL)
    return new Promise((resolve, reject) => {

    const thisURL = url.parse(URL);

    var protocol = (thisURL.protocol == "http") ? http : https;


    const startTime = performance.now();

    const site = {
        path:  thisURL.pathname,
        host: thisURL.hostname,
        port: thisURL.port  
     };

              
      const req = protocol.get(site, async (res) => {

      logResult(resolve, record_id,URL ,  "success",  res.statusCode, "", performance.now() - startTime, resultsDB);


        res.on('data', function (chunk) {
   //         console.log('BODY: ' + chunk);
          });

       

      }).on('error', function(e) {

        logResult(resolve, record_id,URL ,  "error", "", e.code, performance.now() - startTime, resultsDB);
     
      });


    })
  
}


async function  logResult(resolve, record_id, uri ,  testResult , httpcode , errorcode,  loadtime, db )
{

    if(httpcode == '' || httpcode == undefined || httpcode == null) { httpcode = 0;}
    if(loadtime == ''   || loadtime == undefined || loadtime == null  ) { loadtime = 0;}


    console.log(uri + " : " + testResult + " : " + httpcode + " : " + loadtime);
    
    await query(`INSERT INTO results (test_id, url,result,httpcode,errorcode,time) VALUES  ( ${record_id},'${uri}','${testResult}',${httpcode},'${errorcode}',${ Math.floor(loadtime)});`, db);


    resolve('Complete');

}



async function getNextOccurrence(schedule) {
    try {
        var interval = cronParser.parseExpression(schedule);
        return Date. parse(interval.next().toString());
    }
    catch (err) {
        console.log('Error: ' + err.message);
    }
}




async function query(query, db)
{
    let p = new Promise(function (res, rej) {
        db.query(query, function (err, result, fields) {
            if (err) throw err;
            res(result);
          });
        });

    return p;
}




async function getDB()
{
    let p = new Promise(function (res, rej) {

        var con =  mysql.createConnection({
            host: "###########################",
            user: "##########################",
            password: "############################",
            database: "########################"
            
          });
    
          con.connect(function(err) {
            if (err) throw err;
            console.log("Connected!");
            res(con);
          });
    
          });
    
          return p;
    
      
}




app.timer('timerTrigger1', {
    schedule: '0 */5 * * * *',

    handler: async (request, context) => {
    
        const db = await getDB();
        var testPromises = [];
        const schedules = await query("Select * from schedule  Where nextrun <  " + Date.now() ,db);
    
    
    for await (const instance of schedules) {
    
        const nextRun = await query("Update schedule set nextrun = "  + await getNextOccurrence(instance.schedule) + " Where id = " + instance.id , db);
        testPromises.push( testWebSite(instance.url, instance.id, db));
     }
    
    
    
    if(testPromises.length == 0)
    {
        console.log("Finished - No Tests");
        db.end();
        return;
    }
    
    await  Promise.allSettled(testPromises).then(([result]) => {
        db.end();
        console.log("Finished - " + testPromises.length  +  " tests.");
     });

     

    }
});
