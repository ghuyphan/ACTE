#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LivePhotoMotionTranscoder, NSObject)

RCT_EXTERN_METHOD(
  normalize:(NSString *)sourceUri
  destinationBaseUri:(NSString *)destinationBaseUri
  resolver:(RCTPromiseResolveBlock)resolver
  rejecter:(RCTPromiseRejectBlock)rejecter
)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
