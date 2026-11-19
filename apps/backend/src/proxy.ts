import {t} from "../../../packages/config/src/copy";
import { NextResponse, type NextRequest } from 'next/server';
import {originAllowed} from './lib/policy/origins';
export function proxy(request:NextRequest) {
 const configured=process.env.ALLOWED_ORIGINS;
 if(!originAllowed(request.headers.get('origin'),configured))return NextResponse.json({error:t("backend.2d3d45bb8c")},{status:403});
 const response=NextResponse.next();
 const origin=request.headers.get('origin');
 if(origin){
  response.headers.set('Access-Control-Allow-Origin',origin);
  response.headers.set('Vary','Origin');
 }
 return response;
}
export const config={matcher:'/api/:path*'};
