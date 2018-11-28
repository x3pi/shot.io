'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const app = express();
const server = http.Server(app);
const io = socketIO(server);

const FIELD_WIDTH = 1000, FIELD_HEIGHT = 1000;
let walls = {};
let bullets = {};
let players = {};

// Đối tượng trong game

class GameObject {
    constructor(obj = {}) {
        this.id = Math.floor(Math.random() * 1000000000);
        this.x = obj.x;
        this.y = obj.y;
        this.radius = obj.radius;
        this.angle = obj.angle;
    }
    move(distance) {
        const oldX = this.x, oldY = this.y;

        this.x += distance * Math.cos(this.angle);
        this.y += distance * Math.sin(this.angle);

        let collision = false;
        if (this.x <= 0 || this.x >= FIELD_WIDTH || this.y <= 0 || this.y >= FIELD_HEIGHT) {
            collision = true;
        }
        if (this.collisionWalls()) {
            collision = true;
        }
        if (collision) {
            this.x = oldX; this.y = oldY;
        }
        return !collision;
    }
    collisionObj(obj) {
        var dx = obj.x - this.x;
        var dy = obj.y - this.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        return distance < obj.radius + this.radius;
    }
    collisionWalls() {
        return Object.values(walls).some((wall) => this.collisionObj(wall));
    }
    toJSON() {
        return { id: this.id, x: this.x, y: this.y, radius: this.radius, angle: this.angle };
    }
}

// Đạn
class Bullet extends GameObject {
    constructor(obj) {
        super(obj);
        this.radius = 5;
        this.player = obj.player;
    }
    remove() {
        delete this.player.bullets[this.id];
        delete bullets[this.id];
    }
}

// Khởi tạo tường trong map
class Wall extends GameObject {
}

for (let i = 0; i < 4; i++) {
    const wall = new Wall({
        x: Math.random() * FIELD_WIDTH,
        y: Math.random() * FIELD_HEIGHT,
        radius: 50 + Math.random() * 50,
    });
    walls[wall.id] = wall;
}




// Người chơi
class Player extends GameObject {
    constructor(obj = {}) {
        super(obj);
        this.socketId = obj.socketId;
        this.nickname = obj.nickname;
        this.radius = 25;
        this.health = this.maxHealth = 10;
        this.bullets = {};
        this.point = 0;
        this.movement = {};

        do {
            this.x = Math.random() * (FIELD_WIDTH - this.radius);
            this.y = Math.random() * (FIELD_HEIGHT - this.radius);
            this.angle = Math.random() * 2 * Math.PI;
        } while (this.collisionWalls());
    }
    shoot() {
        if (Object.keys(this.bullets).length >= 5) {
            return;
        }

        const bullet = new Bullet({
            x: (this.x + this.radius * Math.cos(this.angle)),
            y: (this.y + this.radius * Math.sin(this.angle)),
            angle: this.angle,
            player: this,
        });
        bullet.move(this.radius / 2);
        this.bullets[bullet.id] = bullet;
        bullets[bullet.id] = bullet;

    }
    damage() {
        this.health--;
        if (this.health === 0) {
            this.remove();
        }
    }
    remove() {
        delete players[this.id];
        io.to(this.socketId).emit('dead');
    }
    toJSON() {
        return Object.assign(super.toJSON(), { health: this.health, maxHealth: this.maxHealth, socketId: this.socketId, point: this.point, nickname: this.nickname });
    }
}


io.on('connection', function (socket) {
    let player = null;
    // Bắt đầu một người chơi mới
    socket.on('game-start', (config) => {
        player = new Player({
            socketId: socket.id,
            nickname: config.nickname,
        });
        players[player.id] = player;
    });

    // Cập nhật trạng thái của người chơi
    socket.on('movement', function (movement) {
        if (!player || player.health === 0) { return; }
        player.movement = movement;
    });

    // Thực hiện bắn đạn
    socket.on('shoot', function () {
        if (!player || player.health === 0) { return; }
        player.shoot();
    });

    // Người chơi disconnect
    socket.on('disconnect', () => {
        if (!player) { return; }
        delete players[player.id];
        player = null;
    });
});

// Vòng lặp cập nhậ trạng thái game
setInterval(() => {
    // Cập nhật trạng thái tất cả  người chơi
    Object.values(players).forEach((player) => {
        const movement = player.movement;
        if (movement.forward) {
            player.move(5);
            player.movement.forward = false;
        }
        if (movement.back) {
            player.move(-5);
            player.movement.back = false;

        }
        if (movement.left) {
            player.angle -= 0.05;
            player.movement.left = false;

        }
        if (movement.right) {
            player.angle += 0.05;
            player.movement.right = false;

        }
        if (movement.shoot) {
            if (!player || player.health === 0) { return; }
            player.shoot();
            player.movement.shoot = false;

        }
    });

    // Cập nhật trạng thái tất cả viên đạn
    Object.values(bullets).forEach((bullet) => {
        // Nếu di chuyển và va chạm từng và vùng bao thì xóa
        if (!bullet.move(10)) {
            bullet.remove();
            return;
        }
        // Nếu va chạm người chơi giảm health người chơi và xóa đạn
        // Và cộng điểu cho người bắn trúng
        Object.values(players).forEach((player) => {
            if (bullet.collisionObj(player)) {
                if (player !== bullet.player) {
                    player.damage();
                    bullet.remove();
                    bullet.player.point += 1;
                }
            }
        });
    });

    // Giửi trạng thái mới tới tất cả các máy khách
    io.sockets.emit('state', players, bullets, walls);
}, 1000 / 30);




app.use('/client', express.static(__dirname + '/client'));

app.get('/', (request, response) => {
    response.sendFile(path.join(__dirname, '/client/index.html'));
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log('listening on port ' + port));
