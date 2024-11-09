"use client";

import { useBusinessProfileForm } from "./useBusinessProfileForm";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { Button } from "../../components/ui/button";
import {
  Form,
  FormControl,
  //   FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { formSchema } from "./formSchema";

export function BusinessProfileForm() {
  const form = useBusinessProfileForm();

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
  }

  return (
    <div
      className={cn("rounded-xl border bg-card text-card-foreground shadow m-10 p-10")}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="tradeName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trade Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Business trade name for the public"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>
                Business trade name for the public.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="legalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Legal Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Legal name of the business for taxes purpose"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>
                Legal name of the business.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Contact email for the business"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>
                Contact email for the business.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Password for the business account"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>
                Password for the business account.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Contact phone number for the business"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>
                Contact phone number for the business.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="taxNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Tax identification number for the business"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>
                Tax identification number for the business.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currencyTrade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency Trade</FormLabel>
                <FormControl>
                  <select {...field} className="form-select">
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                    <option value="CHF">CHF</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subscription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subscription</FormLabel>
                <FormControl>
                  <select {...field} className="form-select">
                    <option value="EUR">Free</option>
                    <option value="USD">Basic</option>
                    <option value="GBP">Premium</option>
                    <option value="JPY">Entreprise</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Country of the business address"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>
                Country of the business address.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input
                    placeholder="State of the business address"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>State of the business address.</FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input
                    placeholder="City of the business address"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>City of the business address.</FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.street"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Street of the business address"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>Street of the business address.</FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.buildingNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Building Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Building number of the business address"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>
                Building number of the business address.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.postCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Post Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Post code of the business address"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>
                Post code of the business address.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.region"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Region</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Region of the business address"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>Region of the business address.</FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.additionalDetails"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Details</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Additional details of the business address"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>
                Additional details of the business address.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.coordinates"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coordinates</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Coordinates of the business address"
                    {...field}
                    value={field.value.join(", ")}
                  />
                </FormControl>
                {/* <FormDescription>
                Coordinates of the business address.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactPerson"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Contact person for the business"
                    {...field}
                  />
                </FormControl>
                {/* <FormDescription>
                Contact person for the business.
              </FormDescription> */}
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit">Submit</Button>
        </form>
      </Form>
    </div>
  );
}
