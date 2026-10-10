#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <LocalAuthentication/LocalAuthentication.h>

@interface ViewController : UIViewController <WKNavigationDelegate>

@property (nonatomic, strong) WKWebView *webView;

@end
