import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../user.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  loginForm;
  constructor(private router: Router, private userService: UserService) { }

  ngOnInit() {
    console.log(window.location.hostname);
    this.userService.checkUser(true);
    this.loginFormInit();
  }

  loginFormInit() {
    this.loginForm = new FormGroup({
      email: new FormControl(''),
      password: new FormControl('')
    });
  }

  loginSubmit() {
    let loginData: any = {};
    this.userService.validateUser(this.loginForm.value).subscribe(
      data => {
        console.log(data);
        loginData = data;
        if (loginData.isUserValid) {
          this.router.navigateByUrl('dashboard');
          this.userService.setLoginUser(loginData);
        } else {
          alert('Incorrect username or password!');
        }
      },
      error => {
        console.log(error);
        alert('Internal Server Error!');
      }
    );
  }

}
