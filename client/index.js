const socket = io();
const elPoint = document.getElementById("point");

const nickname_input = document.getElementById("nickname");
const start_button = document.getElementById("start_button");
const blocker = document.getElementById("blocker");
const start_scene = document.getElementById("start")
var start = false;

// Dự tính sử dụng tính năng khóa chuột để điều khiển bằng chuột nhưng hiện tại chưa sử dụng nó nhiều tính năng có thể có ích cho ứng dụng bắn sùng phức tạp hơn

var havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

if (havePointerLock) {

    var element = document.body;

    var pointerlockchange = function (event) {

        if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {

            blocker.style.display = 'none';

        } else {

            blocker.style.display = '-webkit-box';
            blocker.style.display = '-moz-box';
            blocker.style.display = 'box';

            blocker.style.display = '';
            if (start) start_scene.style.display = 'none';
        }

    }

    var pointerlockerror = function (event) {
        blocker.style.display = '';
    }

    // Hook pointer lock state change events
    document.addEventListener('pointerlockchange', pointerlockchange, false);
    document.addEventListener('mozpointerlockchange', pointerlockchange, false);
    document.addEventListener('webkitpointerlockchange', pointerlockchange, false);

    document.addEventListener('pointerlockerror', pointerlockerror, false);
    document.addEventListener('mozpointerlockerror', pointerlockerror, false);
    document.addEventListener('webkitpointerlockerror', pointerlockerror, false);

    start_button.addEventListener('click', function (event) {
        blocker.style.display = 'none';

        // Ask the browser to lock the pointer
        element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;

        if (/Firefox/i.test(navigator.userAgent)) {

            var fullscreenchange = function (event) {

                if (document.fullscreenElement === element || document.mozFullscreenElement === element || document.mozFullScreenElement === element) {

                    document.removeEventListener('fullscreenchange', fullscreenchange);
                    document.removeEventListener('mozfullscreenchange', fullscreenchange);

                    element.requestPointerLock();
                }

            }

            document.addEventListener('fullscreenchange', fullscreenchange, false);
            document.addEventListener('mozfullscreenchange', fullscreenchange, false);

            element.requestFullscreen = element.requestFullscreen || element.mozRequestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen;

            element.requestFullscreen();

        } else {

            element.requestPointerLock();

        }

    }, false);

} else {

    instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';

}


// Tạo một renderer WebGL và thêm phần tử canvas vào document
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xdddddd);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Tạo một cảnh
var scene = new THREE.Scene();


// Tạo camera
var camera = new THREE.PerspectiveCamera(
    60,                                   // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1,                                  // Near clipping pane
    2000                                  // Far clipping pane
);



// Thêm ánh sáng xung quanh
var ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Thêm ánh sáng DirectionalLight
const light = new THREE.DirectionalLight(0xffffff);
light.position.set(-100, 300, -100);
light.castShadow = true;
light.shadow.camera.left = -2000;
light.shadow.camera.right = 2000;
light.shadow.camera.top = 2000;
light.shadow.camera.bottom = -2000;
light.shadow.camera.far = 2000;
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
scene.add(light);


// Tạo vật liệu 
const bulletMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
const wallMaterial = new THREE.MeshLambertMaterial({ color: 'firebrick' });
const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x800080 });
const textMaterial = new THREE.MeshBasicMaterial({ color: 0xf39800, side: THREE.DoubleSide });
const nicknameMaterial = new THREE.MeshBasicMaterial({ color: 'black', side: THREE.DoubleSide });


// Tạo sàn
const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 1, 1);
const floorMaterial = new THREE.MeshLambertMaterial({ color: 'lawngreen' });
const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
floorMesh.position.set(500, 0, 500);
floorMesh.receiveShadow = true;
floorMesh.rotation.x = - Math.PI / 2;
light.target = floorMesh;
scene.add(floorMesh);


// Đặt vị trí và hướng xem camera 
camera.position.set(1000, 300, 1000);
camera.lookAt(floorMesh.position)



// Tải font

const loader = new THREE.FontLoader();
let font;
loader.load('/client/helvetiker_bold.typeface.json', function (font_) {
    font = font_;
});

// Kết xuất cảnh với vòng lặp vẽ lại
renderer.render(scene, camera);

requestAnimationFrame(render);

function render() {

    renderer.render(scene, camera);
    requestAnimationFrame(render);
}


// Kích thước window thay đổi thiết lập lại camera và canvas renderer
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


// Giửi sự kiện tới máy chủ bắt đầu game


function gameStart() {
    if (!start) {
        const nickname = nickname_input.value;
        socket.emit('game-start', { nickname: nickname });
        blocker.style.display = 'none',
            start = true;
    }
}
start_button.onclick = gameStart;


// Cập nhật trạng thái game liên tục từ máy chủ giửi đến
const Meshes = [];


socket.on('state', (players, bullets, walls) => {
    Object.values(Meshes).forEach((mesh) => { mesh.used = false; });

    // Vẽ Player
    Object.values(players).forEach((player) => {
        let playerMesh = Meshes[player.id];
        if (!playerMesh) {
            playerMesh = new THREE.Group();
            playerMesh.castShadow = true;
            Meshes[player.id] = playerMesh;
            scene.add(playerMesh);
        }
        playerMesh.used = true;
        playerMesh.position.set(player.x, player.radius / 2, player.y);
        playerMesh.rotation.y = - player.angle;

        if (!playerMesh.getObjectByName('body')) {
            mesh = new THREE.Mesh(new THREE.CylinderGeometry(player.radius, player.radius, player.radius), playerMaterial);
            mesh.castShadow = true;
            mesh.name = 'body';
            playerMesh.add(mesh);
        }

        if (font) {
            if (!playerMesh.getObjectByName('nickname')) {
                mesh = new THREE.Mesh(
                    new THREE.TextGeometry(player.nickname,
                        { font: font, size: 4, height: 1 }),
                    nicknameMaterial,
                );
                mesh.name = 'nickname';
                playerMesh.add(mesh);

                mesh.position.set(0, 30, 0);
                mesh.rotation.y = -Math.PI / 2;
            }
            {
                let mesh = playerMesh.getObjectByName('health');

                if (mesh && mesh.health !== player.health) {
                    playerMesh.remove(mesh);
                    mesh.geometry.dispose();
                    mesh = null;
                }
                if (!mesh) {
                    mesh = new THREE.Mesh(
                        new THREE.TextGeometry(player.health.toString(),
                            { font: font, size: 4, height: 1 }),
                        textMaterial,
                    );
                    mesh.name = 'health';
                    mesh.health = player.health;
                    playerMesh.add(mesh);
                }
                mesh.position.set(0, 22, 0);
                mesh.rotation.y = - Math.PI / 2;
            }
        }


        if (player.socketId === socket.id) {
            // Your player
            camera.position.set(
                player.x - 100 * Math.cos(player.angle),
                50,
                player.y - 100 * Math.sin(player.angle)
            );
            camera.rotation.set(0, - player.angle - Math.PI / 2, 0);
            elPoint.innerHTML = "Point: " + player.point;


        }
    });

    // Vẽ đạn
    Object.values(bullets).forEach((bullet) => {
        let mesh = Meshes[bullet.id];
        if (!mesh) {
            mesh = new THREE.Mesh(new THREE.CylinderGeometry(bullet.radius, bullet.radius, bullet.radius), bulletMaterial);
            mesh.castShadow = true;
            Meshes[bullet.id] = mesh;
            scene.add(mesh);
        }
        mesh.used = true;
        mesh.position.set(bullet.x, 10, bullet.y);
    });

    // Vẽ tường
    Object.values(walls).forEach((wall) => {
        let mesh = Meshes[wall.id];
        if (!mesh) {
            mesh = new THREE.Mesh(new THREE.CylinderGeometry(wall.radius, wall.radius, wall.radius), wallMaterial);
            mesh.castShadow = true;
            //Meshes.push(mesh);
            Meshes[wall.id] = mesh;
            scene.add(mesh);
        }
        mesh.used = true;
        mesh.position.set(wall.x, wall.radius / 2 - 1, wall.y);
    });

    // Xóa các mesh không sử dụng hay là các mesh cũ không có trong lần cập nhật tiếp theo
    Object.keys(Meshes).forEach((key) => {
        const mesh = Meshes[key];
        if (!mesh.used) {
            scene.remove(mesh);
            delete Meshes[key];
        }
    });
});

// Xử lý điều khiển của người chơi

let movement = {};
window.onkeydown = function (event) {

    if (event.keyCode == 32) { movement.shoot = true }
    if (event.keyCode == 87) { movement.forward = true }
    if (event.keyCode == 83) { movement.back = true }
    if (event.keyCode == 65) { movement.left = true }
    if (event.keyCode == 68) { movement.right = true }
};


window.onkeyup = function (event) {
    if (event.keyCode == 32) { movement.shoot = false }
    if (event.keyCode == 87) { movement.forward = false }
    if (event.keyCode == 83) { movement.back = false }
    if (event.keyCode == 65) { movement.left = false }
    if (event.keyCode == 68) { movement.right = false }

};


// gửi cập nhật trạng thái người chơi thường xuyên tới máy chủ
setInterval(() => { socket.emit('movement', movement) }, 1000 / 60)


// Xử lý sự kiện khi dead
socket.on('dead', () => {
    start = false
    blocker.style.display = '';
    start_scene.style.display = '';

});