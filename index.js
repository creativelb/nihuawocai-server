var express = require('express');
var expressWs = require('express-ws');

var app = express();
expressWs(app);

port=8080

/**
 * room对象的status字段代表房间的游戏状态
 * -1: 退出
 * 0: 未开始,
 * 1: 开始
 */
let room = {}
let answerArr = ['西瓜', '口红', '大海', '飞机', '火车', '汽车']

app.ws("/socketRoom", function (ws, req) {
    // ws.send("你连接成功了");
    console.log("你连接成功了");
    ws.on("message", function (msg) {
        msg = JSON.parse(msg)
        let {type, data} = msg
        let roomId = data.roomId
        let token = data.token
        console.log(token);
        if(type === 0) {
            ws.roomId = roomId
            ws.token = token
            let user = {roomId: roomId, token: token, isPrepare: 0, ws: ws}
            if(room.hasOwnProperty(roomId)) { // 如果有这个房间那就是加入房间
                user.owner = 0
                room[roomId].userList.push(user)
                let users = room[roomId].userList.map(user => {
                    user = Object.assign({}, user)
                    delete user.ws
                    user.ws2 ? delete user.ws2 : ''
                    return user
                })
                room[roomId].userList.forEach(item => {
                    item.ws.send(JSON.stringify({
                        data: users,
                        type: 0
                    }))
                })
            }else{
                user.owner = 1
                room[roomId] = {}
                room[roomId].status = 0
                room[roomId].userList = []
                let userList = room[roomId].userList
                userList.push(user)
            }
        }else if(type === 1) {
            let isPrepare = data.isPrepare
            let user1 = room[roomId].userList.find(item => {
                return item.token === token 
            })
            user1.isPrepare = isPrepare
            // 服务器判断是否所有用户都准备 如果是则更改房间状态
            if(!room[roomId].userList.find(user => user.isPrepare === 0)) {
                room[roomId].status = 1
            }
            // 将用户传送会服务器前 首先将用户的ws属性去掉 否则json化会死循环
            let user2 = Object.assign({}, user1)
            delete user2.ws
            user2.ws ? delete user2.ws : ''
            room[roomId].userList.forEach(item => {
                item.ws.send(JSON.stringify({
                    type: 1,
                    data: {
                        ...user2
                    }
                }))
            })
        }
        console.log(room);
    });
    // 关闭时判断时加入了游戏还是退出了房间 如果全部退出的话 就关闭房间
    ws.on('close', function (code, reason) {
        debugger
        reason = JSON.parse(reason)
        let roomId = reason.roomId
        let token = reason.token
        console.log(token);
        if(room[roomId].status !== 1) {
            let index = -1;
            room[roomId].userList.forEach((user, i) => {
                if(user.token === token) {
                    index = i
                }
            })
            room[roomId].userList.splice(index, 1)
            // 告诉用户有人退出房间
            let users = room[roomId].userList.map(user => {
                user = Object.assign({}, user)
                delete user.ws
                user.ws2 ? delete user.ws2 : ''
                return user
            })
            room[roomId].userList.forEach(item => {
                item.ws.send(JSON.stringify({
                    data: users,
                    type: 0
                }))
            })
            // 用户退出后 如果房间内的用户数量为0 则解散房间
            if(room[roomId].userList.length === 0) {
                delete room[roomId]
            }
        } 
        console.log(room);
    })
});

/**
 * 游戏页面的websocket
 * type: 0 初始化时发送的请求
 *       1 初始化点击touchstart时的 坐标
 *       2 移动时的坐标
 *       3 发送答案给用户 以及 轮到谁答题
 *       4 切换笔的颜色 (切成白色就可以当做橡皮擦用)
 *       5 切换笔的粗细
 *       6 清屏(暂且不做这个功能)
 *       8 答题失败,时间结束无人答题成功
 *       9 答题成功,有人回答对了问题
 *       -1 用户离开游戏 
 */
let util = require('./util')
app.ws("/socketGame", function (ws, req) {
    // ws.send("你连接成功了");
    console.log("你连接成功了");
    ws.on("message", function (msg) {
        msg = JSON.parse(msg)
        let {type, data} = msg
        let roomId = data.roomId
        let token = data.token
        if(type === 0) {
            ws.roomId = roomId
            ws.token = token
            let user = room[roomId].userList.find(user => user.token === token)
            user.ws2 = ws
            room[roomId].status !== 1 ? room[roomId].status = 0 : ''
            // 判断是否所有用户都进入房间 如果是 则开始游戏 计时开始 且房间内的第一个人为画画的
            // 剩下的为答题的  并且 将谜底给出
            if(!room[roomId].userList.find(user => {
                return !user.ws2
            })){
                let random = util.generateRandom(0, answerArr.length-1)
                let answer = answerArr[random]
                room[roomId].userList.forEach((user, index) => {
                    // 第一个人给出yourturn让他答题
                    if(index === 0){
                        user.ws2.send(JSON.stringify({
                            type: 3,
                            data: {
                                answer: answer,
                                isYourTurn: true
                            }
                        }))
                    }else { // 其余人给出yourturn且不让答题
                        user.ws2.send(JSON.stringify({
                            type: 3,
                            data: {
                                answer: answer,
                                isYourTurn: false
                            }
                        }))
                    }
                })
            }
        }else if(type === 1) {
            room[roomId].userList.forEach(user => {
                if(user.token === token) return
                user.ws2.send(JSON.stringify({
                    type: 1,
                    data: {
                        position: data.position
                    }
                }))
            })
        }else if(type ===2) {
            room[roomId].userList.forEach(user => {
                if(user.token === token) return
                user.ws2.send(JSON.stringify({
                    type: 2,
                    data: {
                        position: data.position
                    }
                }))
            })
        }else if(type ===4) {
            room[roomId].userList.forEach(user => {
                user.ws2.send(JSON.stringify({
                    type: 4,
                    data:{
                        color: data.color
                    }
                }))
            })
        }else if(type ===5) {
            room[roomId].userList.forEach(user => {
                user.ws2.send(JSON.stringify({
                    type: 5,
                    data:{
                        penWidth: data.penWidth
                    }
                }))
            })
        }else if(type === 8) {
            room[roomId].userList.forEach(user => {
                if(user.token === token) return
                user.ws2.send(JSON.stringify({
                    type: 8
                }))
            })
        }else if(type === 9) {
            room[roomId].userList.forEach(user => {
                user.ws2.send(JSON.stringify({
                    type: 9,
                    data:{
                        token: token
                    }
                }))
            })
        }
    })
    // 关闭时判断时加入了游戏还是退出了房间 如果全部退出的话 就关闭房间
    ws.on('close', function (code, reason) {
        debugger
        reason = JSON.parse(reason)
        let roomId = reason.roomId
        let token = reason.token
        console.log(token);
        let index = -1;
        room[roomId].userList.forEach((user, i) => {
            if(user.token === token) {
                index = i
            }
        })
        room[roomId].userList.splice(index, 1)
        // 用户退出后 如果房间内的用户数量为0 则解散房间
        if(room[roomId].userList.length === 0) {
            delete room[roomId]
        }
        console.log(room);
    })
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})