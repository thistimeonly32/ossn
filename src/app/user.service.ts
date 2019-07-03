import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
declare const SockJS: any;
declare const Stomp: any;

@Injectable({
  providedIn: 'root'
})
export class UserService {

  // _url = 'http://192.168.1.17:8080/'
  // _url = 'http://192.168.1.90:8080/'
  _url = `https://${window.location.hostname}:8080`
  // _url = 'http://localhost:8989/ossnapi'

  socket;
  stompClient;
  friends: any;
  constructor(private _http: HttpClient, private router: Router, private cookieService: CookieService) { }

  public validateUser(data): any {
    var u = this._url;
    console.log(u);
    return this._http.post(`${this._url}/login/${data.email}/${data.password}`, null);
  }

  public setLoginUser(data) {
    // localStorage.setItem("email", data.email);
    // localStorage.setItem("name", data.name);
    // localStorage.setItem("peerId", `user-peer-id-${data.userId}`);
    // localStorage.setItem("userId", data.userId);

    this.cookieService.set("email", data.email);
    this.cookieService.set("name", data.name);
    this.cookieService.set("peerId", `user-peer-id-${data.userId}`);
    this.cookieService.set("userId", data.userId);
  }

  public removeLoginUser() {
    // localStorage.removeItem("email");
    // localStorage.removeItem("name");
    // localStorage.removeItem("peerId");
    // localStorage.removeItem("userId");
    this.cookieService.deleteAll();
    
  }

  public getLoggedInUser() {
    let user: any = {};
    // user.email = localStorage.getItem("email")
    // user.name = localStorage.getItem("name")
    // user.peerId = localStorage.getItem("peerId")
    // user.userId = localStorage.getItem("userId")

    user.email = this.cookieService.get("email")
    user.name = this.cookieService.get("name")
    user.peerId = this.cookieService.get("peerId")
    user.userId = this.cookieService.get("userId")
    return user;
  }

  public checkUser(isLoginPage) {
    if (this.cookieService.check("email")) {

      if (isLoginPage) {
        this.router.navigateByUrl('dashboard');
      }
    } else {
      this.router.navigateByUrl('login');
    }
  }

  public prepareUser() {
    this.socket = new SockJS(`${this._url}/ossnapi-websocket?userId=${this.cookieService.get("userId")}`);
    this.stompClient = Stomp.over(this.socket);
    this.stompClient.connect({}, (frame) => {
      console.log('Connected msg: ' + frame);
      this.subscribeToPrivateMessage();
      this.sendLoginMessage();
    });
  }

  public getFriends(userId) {
    return this._http.get(`${this._url}/user/friends/${userId}`);
  }

  public getMessages(toUserId, fromUserId, currentPage, timeStr) {
    return this._http.get(`${this._url}/user/messages/${toUserId}/${fromUserId}/${currentPage}/${timeStr}`);
  }

  public saveMessage(data) {
    return this._http.post(`${this._url}/user/save-message`, data);
  }

  public subscribeToPrivateMessage() {
    this.stompClient.subscribe('/user/queue/private', (res) => {
      console.log("got private response: " + res);
    });
  }

  public sendLoginMessage() {
    this.friends.forEach(element => {
      this.stompClient.send('/user/' + element.userId + '/queue/private', {}, JSON.stringify(
        {
          'messageType': 'online',
          'userId': this.cookieService.get("userId")
        }
      ));
    });
  }

}
